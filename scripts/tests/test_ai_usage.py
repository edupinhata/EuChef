import json
import multiprocessing
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock
from urllib.parse import quote

from scripts.ai_usage import (
    UsageCollectionError,
    aggregate_usage,
    finish_measurement,
    render_report,
    start_measurement,
)


class FakeCollector:
    def __init__(self, main_session, subagents=None):
        self.main_session = main_session
        self.subagents = subagents or []

    def session(self, session_id):
        if session_id != self.main_session["id"]:
            raise AssertionError(f"unexpected session id: {session_id}")
        return self.main_session

    def subagents_since(self, started_at):
        return [
            session for session in self.subagents if session["started_at"] >= started_at
        ]


class BarrierCollector(FakeCollector):
    def __init__(self, main_session, barrier):
        super().__init__(main_session)
        self.barrier = barrier

    def session(self, session_id):
        result = super().session(session_id)
        self.barrier.wait(timeout=5)
        return result


class SlowCollector(FakeCollector):
    def session(self, session_id):
        result = super().session(session_id)
        time.sleep(0.4)
        return result


def finish_process_worker(
    result_queue,
    start_barrier,
    snapshot_path,
    history_path,
    pr_number,
):
    start_barrier.wait(timeout=10)
    try:
        finish_measurement(
            work_id="single-consumption",
            pr_number=pr_number,
            pr_url=f"https://github.com/example/repo/pull/{pr_number}",
            title=f"Consume snapshot for PR {pr_number}",
            activities=["Exercise process-safe snapshot consumption"],
            commit_sha="a" * 40,
            snapshot_path=Path(snapshot_path),
            history_path=Path(history_path),
            collector=SlowCollector(session("main-1")),
            captured_at=200.0,
        )
        result_queue.put("ok")
    except Exception as error:  # pragma: no cover - assertion occurs in the parent
        result_queue.put(f"error:{type(error).__name__}:{error}")


def session(
    session_id,
    *,
    started_at=100.0,
    input_tokens=0,
    output_tokens=0,
    cache_read_tokens=0,
    cache_write_tokens=0,
    reasoning_tokens=0,
    api_call_count=0,
    tool_call_count=0,
    estimated_cost_usd=0.0,
    actual_cost_usd=None,
    cost_source="none",
    cost_status="included",
    pricing_version=None,
    parent_session_id=None,
    model="gpt-test",
    provider="test-provider",
):
    return {
        "id": session_id,
        "source": "subagent" if parent_session_id else "telegram",
        "started_at": started_at,
        "ended_at": started_at + 10,
        "model": model,
        "billing_provider": provider,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cache_read_tokens": cache_read_tokens,
        "cache_write_tokens": cache_write_tokens,
        "reasoning_tokens": reasoning_tokens,
        "api_call_count": api_call_count,
        "tool_call_count": tool_call_count,
        "estimated_cost_usd": estimated_cost_usd,
        "actual_cost_usd": actual_cost_usd,
        "cost_source": cost_source,
        "cost_status": cost_status,
        "pricing_version": pricing_version,
        "parent_session_id": parent_session_id,
        "messages": [{"content": "must never be persisted"}],
        "system_prompt": "must never be persisted",
        "origin_json": {"token": "must never be persisted"},
    }


class AiUsageTest(unittest.TestCase):
    def test_start_persists_only_sanitized_counters(self):
        with tempfile.TemporaryDirectory() as directory:
            snapshot_path = Path(directory) / "work.json"
            collector = FakeCollector(
                session(
                    "main-1",
                    input_tokens=100,
                    output_tokens=20,
                    cache_read_tokens=300,
                    reasoning_tokens=5,
                )
            )

            start_measurement(
                work_id="catalog-pagination",
                session_id="main-1",
                snapshot_path=snapshot_path,
                collector=collector,
                captured_at=150.0,
            )

            snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
            serialized = json.dumps(snapshot)
            self.assertEqual(snapshot["workId"], "catalog-pagination")
            self.assertEqual(snapshot["session"]["inputTokens"], 100)
            self.assertNotIn("messages", serialized)
            self.assertNotIn("system_prompt", serialized)
            self.assertNotIn("origin_json", serialized)
            self.assertNotIn("must never be persisted", serialized)

    def test_start_rejects_every_missing_hermes_counter(self):
        counter_fields = [
            "input_tokens",
            "output_tokens",
            "cache_read_tokens",
            "cache_write_tokens",
            "reasoning_tokens",
            "api_call_count",
            "tool_call_count",
        ]
        for counter in counter_fields:
            with (
                self.subTest(counter=counter),
                tempfile.TemporaryDirectory() as directory,
            ):
                snapshot_path = Path(directory) / "work.json"
                incomplete = session("main-1")
                del incomplete[counter]

                with self.assertRaisesRegex(UsageCollectionError, "counter"):
                    start_measurement(
                        work_id="missing-counter",
                        session_id="main-1",
                        snapshot_path=snapshot_path,
                        collector=FakeCollector(incomplete),
                        captured_at=100.0,
                    )

                self.assertFalse(snapshot_path.exists())

    def test_aggregate_usage_sums_main_delta_and_linked_subagents(self):
        start = session(
            "main-1",
            input_tokens=100,
            output_tokens=20,
            cache_read_tokens=300,
            api_call_count=2,
            tool_call_count=3,
        )
        end = session(
            "main-1",
            input_tokens=180,
            output_tokens=35,
            cache_read_tokens=420,
            reasoning_tokens=4,
            api_call_count=5,
            tool_call_count=8,
        )
        linked = session(
            "sub-1",
            started_at=160.0,
            input_tokens=40,
            output_tokens=10,
            cache_read_tokens=90,
            reasoning_tokens=3,
            api_call_count=2,
            tool_call_count=4,
            parent_session_id="main-1",
        )
        unrelated = session(
            "sub-2",
            started_at=165.0,
            input_tokens=999,
            parent_session_id="another-main",
        )

        result = aggregate_usage(start, end, [linked, unrelated])

        self.assertEqual(result["totals"]["inputTokens"], 120)
        self.assertEqual(result["totals"]["outputTokens"], 25)
        self.assertEqual(result["totals"]["cacheReadTokens"], 210)
        self.assertEqual(result["totals"]["reasoningTokens"], 7)
        self.assertEqual(result["totals"]["totalTokens"], 145)
        self.assertEqual(result["totals"]["apiCalls"], 5)
        self.assertEqual(result["totals"]["toolCalls"], 9)
        self.assertEqual(
            [agent["sessionId"] for agent in result["agents"]], ["main-1", "sub-1"]
        )
        self.assertEqual(result["cost"]["status"], "included")
        self.assertIsNone(result["cost"]["actualUsd"])
        self.assertIsNone(result["cost"]["estimatedUsd"])

    def test_finish_appends_record_and_deletes_local_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot_path = root / "work.json"
            history_path = root / "pr-costs.jsonl"
            start = session("main-1", input_tokens=10, output_tokens=2)
            start_measurement(
                work_id="search-index",
                session_id="main-1",
                snapshot_path=snapshot_path,
                collector=FakeCollector(start),
                captured_at=100.0,
            )
            end = session("main-1", input_tokens=30, output_tokens=7)
            collector = FakeCollector(end)

            record = finish_measurement(
                work_id="search-index",
                pr_number=19,
                pr_url="https://github.com/example/repo/pull/19",
                title="Track AI usage per pull request",
                activities=["Add token snapshots", "Document the workflow"],
                commit_sha="a" * 40,
                snapshot_path=snapshot_path,
                history_path=history_path,
                collector=collector,
                captured_at=200.0,
            )

            stored = json.loads(history_path.read_text(encoding="utf-8"))
            self.assertEqual(stored, record)
            self.assertEqual(stored["measurementStatus"], "complete")
            self.assertEqual(
                stored["measurementScope"],
                "development-through-final-local-validation",
            )
            self.assertEqual(stored["totals"]["totalTokens"], 25)
            self.assertFalse(snapshot_path.exists())
            self.assertNotIn("messages", json.dumps(stored))

    def test_rejects_counters_that_move_backwards(self):
        start = session("main-1", input_tokens=100)
        end = session("main-1", input_tokens=99)

        with self.assertRaisesRegex(UsageCollectionError, "moved backwards"):
            aggregate_usage(start, end, [])

    def test_rejects_unsafe_work_id(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(UsageCollectionError, "work-id"):
                start_measurement(
                    work_id="../outside",
                    session_id="main-1",
                    snapshot_path=Path(directory) / "outside.json",
                    collector=FakeCollector(session("main-1")),
                )

    def test_rejects_duplicate_pull_request_and_preserves_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot_path = root / "work.json"
            history_path = root / "pr-costs.jsonl"
            history_path.write_text(
                json.dumps({"pullRequest": {"number": 19}}) + "\n",
                encoding="utf-8",
            )
            start_measurement(
                work_id="duplicate-check",
                session_id="main-1",
                snapshot_path=snapshot_path,
                collector=FakeCollector(session("main-1")),
                captured_at=100.0,
            )

            with self.assertRaisesRegex(UsageCollectionError, "already exists"):
                finish_measurement(
                    work_id="duplicate-check",
                    pr_number=19,
                    pr_url="https://github.com/example/repo/pull/19",
                    title="Duplicate",
                    activities=["Should not append"],
                    commit_sha="a" * 40,
                    snapshot_path=snapshot_path,
                    history_path=history_path,
                    collector=FakeCollector(session("main-1")),
                    captured_at=200.0,
                )

            self.assertTrue(snapshot_path.exists())
            self.assertEqual(
                len(history_path.read_text(encoding="utf-8").splitlines()), 1
            )

    def test_rejects_preexisting_duplicate_pr_or_work_id_in_history(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot_path = root / "work.json"
            history_path = root / "history.jsonl"
            duplicate = {
                "workId": "corrupt-history",
                "pullRequest": {"number": 19},
            }
            history_path.write_text(
                "\n".join((json.dumps(duplicate), json.dumps(duplicate))) + "\n",
                encoding="utf-8",
            )
            start_measurement(
                work_id="corrupt-history",
                session_id="main-1",
                snapshot_path=snapshot_path,
                collector=FakeCollector(session("main-1")),
                captured_at=100.0,
            )

            with self.assertRaisesRegex(UsageCollectionError, "duplicate"):
                finish_measurement(
                    work_id="corrupt-history",
                    pr_number=19,
                    pr_url="https://github.com/example/repo/pull/19",
                    title="Reject corrupt history",
                    activities=["Validate all historical rows before recovery"],
                    commit_sha="a" * 40,
                    snapshot_path=snapshot_path,
                    history_path=history_path,
                    collector=FakeCollector(session("main-1")),
                    captured_at=200.0,
                )

            self.assertTrue(snapshot_path.exists())
            self.assertEqual(
                len(history_path.read_text(encoding="utf-8").splitlines()), 2
            )

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot_path = root / "work.json"
            history_path = root / "history.jsonl"
            records = [
                {"workId": "reused-work", "pullRequest": {"number": 19}},
                {"workId": "reused-work", "pullRequest": {"number": 20}},
            ]
            history_path.write_text(
                "\n".join(json.dumps(record) for record in records) + "\n",
                encoding="utf-8",
            )
            start_measurement(
                work_id="new-work",
                session_id="main-1",
                snapshot_path=snapshot_path,
                collector=FakeCollector(session("main-1")),
                captured_at=100.0,
            )

            with self.assertRaisesRegex(UsageCollectionError, "duplicate workId"):
                finish_measurement(
                    work_id="new-work",
                    pr_number=21,
                    pr_url="https://github.com/example/repo/pull/21",
                    title="Reject reused work identifier",
                    activities=["Validate work identifiers across all rows"],
                    commit_sha="a" * 40,
                    snapshot_path=snapshot_path,
                    history_path=history_path,
                    collector=FakeCollector(session("main-1")),
                    captured_at=200.0,
                )

            self.assertTrue(snapshot_path.exists())

    def test_rejects_sensitive_or_invalid_free_text_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot_path = root / "work.json"
            start_measurement(
                work_id="secret-check",
                session_id="main-1",
                snapshot_path=snapshot_path,
                collector=FakeCollector(session("main-1")),
                captured_at=100.0,
            )

            unsafe_activities = [
                "Authorization: Bearer ***",
                "postgresql://alice:p4ss@db.internal/euchef",
                "postgresql%3A%2F%2Falice%3Ap4ss%40db.internal%2Feuchef",
                (
                    "postgresql%2525253A%2525252F%2525252Falice%2525253A"
                    "p4ss%25252540db.internal%2525252Feuchef"
                ),
                "％41",
                "％25％32％35％33％41",
                "％68％74％74％70％73％3A％2F％2Fexample.com",
                quote(
                    "ｐｏｓｔｇｒｅｓｑｌ：／／ａｌｉｃｅ：ｐ４ｓｓ＠ｄｂ．ｉｎｔｅｒｎａｌ／ｅｕｃｈｅｆ",
                    safe="",
                ),
            ]
            for activity in unsafe_activities:
                with self.subTest(activity=activity):
                    with self.assertRaisesRegex(UsageCollectionError, "sensitive"):
                        finish_measurement(
                            work_id="secret-check",
                            pr_number=19,
                            pr_url="https://github.com/example/repo/pull/19",
                            title="Track usage",
                            activities=[activity],
                            commit_sha="a" * 40,
                            snapshot_path=snapshot_path,
                            history_path=root / "history.jsonl",
                            collector=FakeCollector(session("main-1")),
                            captured_at=200.0,
                        )

            self.assertTrue(snapshot_path.exists())

    def test_concurrent_finishes_write_only_one_record(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            history_path = root / "history.jsonl"
            snapshots = [root / "first.json", root / "second.json"]
            for work_id, snapshot_path in zip(("first", "second"), snapshots):
                start_measurement(
                    work_id=work_id,
                    session_id="main-1",
                    snapshot_path=snapshot_path,
                    collector=FakeCollector(session("main-1")),
                    captured_at=100.0,
                )

            barrier = threading.Barrier(2)
            successes = []
            errors = []

            def finish(work_id, snapshot_path):
                try:
                    successes.append(
                        finish_measurement(
                            work_id=work_id,
                            pr_number=19,
                            pr_url="https://github.com/example/repo/pull/19",
                            title="Concurrent finish",
                            activities=["Validate atomic history updates"],
                            commit_sha="a" * 40,
                            snapshot_path=snapshot_path,
                            history_path=history_path,
                            collector=BarrierCollector(
                                session("main-1", input_tokens=10), barrier
                            ),
                            captured_at=200.0,
                        )
                    )
                except UsageCollectionError as error:
                    errors.append(error)

            threads = [
                threading.Thread(target=finish, args=(work_id, snapshot_path))
                for work_id, snapshot_path in zip(("first", "second"), snapshots)
            ]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(timeout=10)

            self.assertEqual(len(successes), 1)
            self.assertEqual(len(errors), 1)
            self.assertIn("already exists", str(errors[0]))
            self.assertEqual(
                len(history_path.read_text(encoding="utf-8").splitlines()), 1
            )
            self.assertEqual(sum(path.exists() for path in snapshots), 1)

    def test_same_snapshot_is_consumed_once_across_processes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot_path = root / "single.json"
            history_path = root / "history.jsonl"
            start_measurement(
                work_id="single-consumption",
                session_id="main-1",
                snapshot_path=snapshot_path,
                collector=FakeCollector(session("main-1")),
                captured_at=100.0,
            )
            context = multiprocessing.get_context("spawn")
            result_queue = context.Queue()
            start_barrier = context.Barrier(2)
            processes = [
                context.Process(
                    target=finish_process_worker,
                    args=(
                        result_queue,
                        start_barrier,
                        str(snapshot_path),
                        str(history_path),
                        pr_number,
                    ),
                )
                for pr_number in (19, 20)
            ]

            for process in processes:
                process.start()
            for process in processes:
                process.join(timeout=20)

            self.assertTrue(all(process.exitcode == 0 for process in processes))
            results = [result_queue.get(timeout=5) for _ in processes]
            self.assertEqual(results.count("ok"), 1)
            self.assertEqual(sum(result.startswith("error:") for result in results), 1)
            self.assertEqual(
                len(history_path.read_text(encoding="utf-8").splitlines()), 1
            )
            self.assertFalse(snapshot_path.exists())

    def test_retry_recovers_after_history_commit_but_snapshot_cleanup_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot_path = root / "retry.json"
            history_path = root / "history.jsonl"
            start_measurement(
                work_id="retry-cleanup",
                session_id="main-1",
                snapshot_path=snapshot_path,
                collector=FakeCollector(session("main-1")),
                captured_at=100.0,
            )
            original_unlink = Path.unlink

            def fail_snapshot_cleanup(path, *args, **kwargs):
                if path == snapshot_path:
                    raise OSError("simulated cleanup failure")
                return original_unlink(path, *args, **kwargs)

            arguments = {
                "work_id": "retry-cleanup",
                "pr_number": 19,
                "pr_url": "https://github.com/example/repo/pull/19",
                "title": "Retry cleanup safely",
                "activities": ["Recover an already committed measurement"],
                "commit_sha": "a" * 40,
                "snapshot_path": snapshot_path,
                "history_path": history_path,
                "collector": FakeCollector(session("main-1")),
                "captured_at": 200.0,
            }
            with mock.patch.object(Path, "unlink", new=fail_snapshot_cleanup):
                with self.assertRaisesRegex(UsageCollectionError, "committed"):
                    finish_measurement(**arguments)

            recovered = finish_measurement(**arguments)

            self.assertEqual(recovered["workId"], "retry-cleanup")
            self.assertEqual(
                len(history_path.read_text(encoding="utf-8").splitlines()), 1
            )
            self.assertFalse(snapshot_path.exists())

    def test_reports_mixed_actual_and_estimated_cost_without_hiding_subtotal(self):
        start = session(
            "main-1",
            actual_cost_usd=0.0,
            cost_source="actual",
            cost_status="actual",
        )
        end = session(
            "main-1",
            actual_cost_usd=1.0,
            cost_source="actual",
            cost_status="actual",
        )
        child = session(
            "sub-1",
            parent_session_id="main-1",
            estimated_cost_usd=0.5,
            cost_source="pricing-table",
            cost_status="estimated",
            pricing_version="prices-v1",
        )

        result = aggregate_usage(start, end, [child])

        self.assertEqual(result["cost"]["status"], "mixed")
        self.assertEqual(result["cost"]["actualUsd"], 1.0)
        self.assertEqual(result["cost"]["estimatedUsd"], 0.5)
        report = render_report(
            [
                {
                    "measurementStatus": "complete",
                    "pullRequest": {"number": 19, "title": "Mixed cost"},
                    "totals": result["totals"],
                    "cost": result["cost"],
                }
            ]
        )
        self.assertIn("actual USD 1.000000", report)
        self.assertIn("estimated USD 0.500000", report)
        self.assertIn("mixed", report)

    def test_aggregates_nested_subagents_transitively(self):
        start = session("main-1")
        end = session("main-1", input_tokens=5)
        child = session("sub-1", input_tokens=10, parent_session_id="main-1")
        grandchild = session("sub-2", input_tokens=20, parent_session_id="sub-1")

        result = aggregate_usage(start, end, [grandchild, child])

        self.assertEqual(result["totals"]["inputTokens"], 35)
        self.assertEqual(
            [agent["sessionId"] for agent in result["agents"]],
            ["main-1", "sub-1", "sub-2"],
        )

    def test_rejects_invalid_costs_incomplete_snapshots_and_model_changes(self):
        with self.subTest("negative subagent cost"):
            child = session(
                "sub-1",
                parent_session_id="main-1",
                actual_cost_usd=-1.0,
                cost_source="actual",
                cost_status="actual",
            )
            with self.assertRaisesRegex(UsageCollectionError, "cost"):
                aggregate_usage(session("main-1"), session("main-1"), [child])

        with self.subTest("non-finite main cost"):
            with self.assertRaisesRegex(UsageCollectionError, "finite"):
                aggregate_usage(
                    session("main-1", actual_cost_usd=0.0),
                    session("main-1", actual_cost_usd=float("nan")),
                    [],
                )

        with self.subTest("infinite subagent cost"):
            child = session(
                "sub-1",
                parent_session_id="main-1",
                estimated_cost_usd=float("inf"),
                cost_source="pricing-table",
                cost_status="estimated",
            )
            with self.assertRaisesRegex(UsageCollectionError, "finite"):
                aggregate_usage(session("main-1"), session("main-1"), [child])

        with self.subTest("boolean cost"):
            child = session(
                "sub-1",
                parent_session_id="main-1",
                actual_cost_usd=True,
                cost_source="actual",
                cost_status="actual",
            )
            with self.assertRaisesRegex(UsageCollectionError, "numeric"):
                aggregate_usage(session("main-1"), session("main-1"), [child])

        with self.subTest("non-scalar cost metadata"):
            with tempfile.TemporaryDirectory() as directory:
                for index, (field, value) in enumerate(
                    (
                        ("cost_source", {"password": "synthetic-value"}),
                        ("cost_status", ["included"]),
                        ("pricing_version", {"credential": "synthetic-value"}),
                    )
                ):
                    unsafe_session = session("main-1")
                    unsafe_session[field] = value
                    snapshot_path = Path(directory) / f"unsafe-{index}.json"
                    with self.subTest(field=field):
                        with self.assertRaisesRegex(UsageCollectionError, "metadata"):
                            start_measurement(
                                work_id=f"unsafe-metadata-{index}",
                                session_id="main-1",
                                snapshot_path=snapshot_path,
                                collector=FakeCollector(unsafe_session),
                                captured_at=100.0,
                            )
                        self.assertFalse(snapshot_path.exists())

        with self.subTest("model change"):
            with self.assertRaisesRegex(UsageCollectionError, "model or provider"):
                aggregate_usage(
                    session("main-1", model="model-a"),
                    session("main-1", model="model-b"),
                    [],
                )

        with self.subTest("invalid parent session metadata"):
            child = session("sub-1", parent_session_id="postgresql://user@db")
            with self.assertRaisesRegex(UsageCollectionError, "metadata"):
                aggregate_usage(session("main-1"), session("main-1"), [child])

        with self.subTest("incomplete snapshot"):
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                snapshot_path = root / "work.json"
                start_measurement(
                    work_id="broken-snapshot",
                    session_id="main-1",
                    snapshot_path=snapshot_path,
                    collector=FakeCollector(session("main-1")),
                    captured_at=100.0,
                )
                snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
                del snapshot["session"]["inputTokens"]
                snapshot_path.write_text(json.dumps(snapshot), encoding="utf-8")

                with self.assertRaisesRegex(UsageCollectionError, "snapshot"):
                    finish_measurement(
                        work_id="broken-snapshot",
                        pr_number=19,
                        pr_url="https://github.com/example/repo/pull/19",
                        title="Broken snapshot",
                        activities=["Reject corrupt state"],
                        commit_sha="a" * 40,
                        snapshot_path=snapshot_path,
                        history_path=root / "history.jsonl",
                        collector=FakeCollector(session("main-1")),
                        captured_at=200.0,
                    )

        with self.subTest("tampered snapshot timestamp"):
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                snapshot_path = root / "work.json"
                start_measurement(
                    work_id="tampered-timestamp",
                    session_id="main-1",
                    snapshot_path=snapshot_path,
                    collector=FakeCollector(session("main-1")),
                    captured_at=100.0,
                )
                snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
                snapshot["capturedAt"] = "not-the-captured-epoch"
                snapshot_path.write_text(json.dumps(snapshot), encoding="utf-8")

                with self.assertRaisesRegex(UsageCollectionError, "capturedAt"):
                    finish_measurement(
                        work_id="tampered-timestamp",
                        pr_number=19,
                        pr_url="https://github.com/example/repo/pull/19",
                        title="Reject tampered timestamp",
                        activities=["Validate snapshot timestamps"],
                        commit_sha="a" * 40,
                        snapshot_path=snapshot_path,
                        history_path=root / "history.jsonl",
                        collector=FakeCollector(session("main-1")),
                        captured_at=200.0,
                    )

        with self.subTest("oversized captured epoch"):
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                snapshot_path = root / "work.json"
                start_measurement(
                    work_id="oversized-captured-epoch",
                    session_id="main-1",
                    snapshot_path=snapshot_path,
                    collector=FakeCollector(session("main-1")),
                    captured_at=100.0,
                )
                snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
                snapshot["capturedAtEpoch"] = 10**400
                snapshot_path.write_text(json.dumps(snapshot), encoding="utf-8")

                with self.assertRaises(UsageCollectionError):
                    finish_measurement(
                        work_id="oversized-captured-epoch",
                        pr_number=19,
                        pr_url="https://github.com/example/repo/pull/19",
                        title="Reject oversized captured epoch",
                        activities=["Validate snapshot numeric bounds"],
                        commit_sha="a" * 40,
                        snapshot_path=snapshot_path,
                        history_path=root / "history.jsonl",
                        collector=FakeCollector(session("main-1")),
                        captured_at=200.0,
                    )
                self.assertTrue(snapshot_path.exists())

    def test_rejects_composite_hermes_metadata_in_all_routes(self):
        invalid_fields = {
            "id": {"value": "synthetic"},
            "source": ["synthetic"],
            "model": {"value": "synthetic"},
            "billing_provider": ["synthetic"],
            "started_at": {"value": 100.0},
            "ended_at": [200.0],
            "cost_source": {"value": "actual"},
            "cost_status": ["included"],
            "pricing_version": {"value": "prices-v1"},
        }

        for field, value in invalid_fields.items():
            with self.subTest(route="start", field=field):
                with tempfile.TemporaryDirectory() as directory:
                    snapshot_path = Path(directory) / "work.json"
                    invalid = session("main-1")
                    invalid[field] = value
                    with self.assertRaisesRegex(UsageCollectionError, "metadata"):
                        start_measurement(
                            work_id="invalid-metadata",
                            session_id="main-1",
                            snapshot_path=snapshot_path,
                            collector=mock.Mock(
                                session=mock.Mock(return_value=invalid)
                            ),
                            captured_at=100.0,
                        )
                    self.assertFalse(snapshot_path.exists())

            with self.subTest(route="delta", field=field):
                invalid = session("main-1")
                invalid[field] = value
                with self.assertRaisesRegex(UsageCollectionError, "metadata"):
                    aggregate_usage(session("main-1"), invalid, [])

            with self.subTest(route="subagent", field=field):
                invalid = session("sub-1", parent_session_id="main-1")
                invalid[field] = value
                with self.assertRaisesRegex(UsageCollectionError, "metadata"):
                    aggregate_usage(session("main-1"), session("main-1"), [invalid])

        oversized_fields = {
            "started_at": 10**10000,
            "ended_at": 10**10000,
            "actual_cost_usd": 10**10000,
            "estimated_cost_usd": 10**10000,
        }
        for field, value in oversized_fields.items():
            with self.subTest(route="start", field=field, value="oversized"):
                with tempfile.TemporaryDirectory() as directory:
                    snapshot_path = Path(directory) / "work.json"
                    invalid = session("main-1")
                    invalid[field] = value
                    with self.assertRaises(UsageCollectionError):
                        start_measurement(
                            work_id="oversized-number",
                            session_id="main-1",
                            snapshot_path=snapshot_path,
                            collector=mock.Mock(
                                session=mock.Mock(return_value=invalid)
                            ),
                            captured_at=100.0,
                        )
                    self.assertFalse(snapshot_path.exists())

            with self.subTest(route="delta", field=field, value="oversized"):
                invalid = session("main-1")
                invalid[field] = value
                with self.assertRaises(UsageCollectionError):
                    aggregate_usage(session("main-1"), invalid, [])

            with self.subTest(route="subagent", field=field, value="oversized"):
                invalid = session("sub-1", parent_session_id="main-1")
                invalid[field] = value
                with self.assertRaises(UsageCollectionError):
                    aggregate_usage(session("main-1"), session("main-1"), [invalid])

        for value in ({"value": "main-1"}, ["main-1"]):
            with self.subTest(route="subagent", field="parent_session_id"):
                invalid = session("sub-1", parent_session_id="main-1")
                invalid["parent_session_id"] = value
                with self.assertRaisesRegex(UsageCollectionError, "metadata"):
                    aggregate_usage(session("main-1"), session("main-1"), [invalid])

    def test_rejects_partial_history_and_cyclic_subagents(self):
        with self.subTest("partial history"):
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                snapshot_path = root / "work.json"
                history_path = root / "history.jsonl"
                history_path.write_text('{"pullRequest":', encoding="utf-8")
                start_measurement(
                    work_id="partial-history",
                    session_id="main-1",
                    snapshot_path=snapshot_path,
                    collector=FakeCollector(session("main-1")),
                    captured_at=100.0,
                )

                with self.assertRaisesRegex(UsageCollectionError, "partial JSONL"):
                    finish_measurement(
                        work_id="partial-history",
                        pr_number=19,
                        pr_url="https://github.com/example/repo/pull/19",
                        title="Reject partial history",
                        activities=["Keep the existing history intact"],
                        commit_sha="a" * 40,
                        snapshot_path=snapshot_path,
                        history_path=history_path,
                        collector=FakeCollector(session("main-1")),
                        captured_at=200.0,
                    )

                self.assertEqual(
                    history_path.read_text(encoding="utf-8"), '{"pullRequest":'
                )
                self.assertTrue(snapshot_path.exists())

        with self.subTest("cyclic subagents"):
            first = session("sub-1", parent_session_id="sub-2")
            second = session("sub-2", parent_session_id="sub-1")
            with self.assertRaisesRegex(UsageCollectionError, "Cycle"):
                aggregate_usage(session("main-1"), session("main-1"), [first, second])

    def test_concurrent_starts_create_exactly_one_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            snapshot_path = Path(directory) / "work.json"
            barrier = threading.Barrier(2)
            successes = []
            errors = []

            def start():
                try:
                    successes.append(
                        start_measurement(
                            work_id="atomic-start",
                            session_id="main-1",
                            snapshot_path=snapshot_path,
                            collector=BarrierCollector(session("main-1"), barrier),
                            captured_at=100.0,
                        )
                    )
                except UsageCollectionError as error:
                    errors.append(error)

            threads = [threading.Thread(target=start) for _ in range(2)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(timeout=10)

            self.assertEqual(len(successes), 1)
            self.assertEqual(len(errors), 1)
            self.assertTrue(snapshot_path.exists())

    def test_report_distinguishes_complete_and_unavailable_measurements(self):
        records = [
            {
                "measurementStatus": "unavailable",
                "pullRequest": {"number": 18, "title": "P1 performance"},
                "totals": None,
                "cost": {
                    "status": "unavailable",
                    "actualUsd": None,
                    "estimatedUsd": None,
                },
            },
            {
                "measurementStatus": "complete",
                "pullRequest": {"number": 19, "title": "AI usage tracking"},
                "totals": {
                    "totalTokens": 145,
                    "inputTokens": 120,
                    "outputTokens": 25,
                    "cacheReadTokens": 210,
                },
                "cost": {"status": "included", "actualUsd": None, "estimatedUsd": None},
            },
        ]

        report = render_report(records)

        self.assertIn("#18\tunavailable\tn/a", report)
        self.assertIn("#19\tcomplete\t145\t120\t25\t210\tincluded", report)


if __name__ == "__main__":
    unittest.main()
