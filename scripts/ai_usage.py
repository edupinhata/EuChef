#!/usr/bin/env python3
"""Track sanitized Hermes token usage deltas for pull requests."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
import time
import unicodedata
from collections import deque
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import urlparse


class UsageCollectionError(RuntimeError):
    """Raised when trustworthy usage data cannot be collected."""


_COUNTERS = {
    "input_tokens": "inputTokens",
    "output_tokens": "outputTokens",
    "cache_read_tokens": "cacheReadTokens",
    "cache_write_tokens": "cacheWriteTokens",
    "reasoning_tokens": "reasoningTokens",
    "api_call_count": "apiCalls",
    "tool_call_count": "toolCalls",
}
_SAFE_WORK_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$")
_COMMIT_SHA = re.compile(r"[0-9a-f]{40}")
_PERCENT_ESCAPE = re.compile(r"%[0-9A-Fa-f]{2}")
_TECHNICAL_METADATA = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:/+\-]{0,199}")
_PRICING_VERSION = re.compile(r"[A-Za-z0-9][A-Za-z0-9._+\-]{0,79}")
_COST_SOURCES = {
    None,
    "none",
    "actual",
    "provider",
    "pricing",
    "pricing-table",
    "estimated",
}
_COST_STATUSES = {
    None,
    "actual",
    "estimated",
    "included",
    "unavailable",
    "unknown",
}
_SENSITIVE_TEXT = re.compile(
    r"(?i)(authorization|bearer|api[ _-]?key|password|passwd|secret|credential|"
    r"private[ _-]?key|access[ _-]?key|cookie|connection[ _-]?string|"
    r"-----BEGIN|AKIA[0-9A-Z]{16}|"
    r"\b[a-z][a-z0-9+.-]{1,20}://|[^\s:/?#]+:[^\s/@]+@|"
    r"\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{8,}|"
    r"[A-Za-z0-9_+/=-]{32,})"
)
_SNAPSHOT_SESSION_FIELDS = {
    "sessionId",
    "source",
    "model",
    "provider",
    *_COUNTERS.values(),
    "totalTokens",
    "actualCostUsd",
    "estimatedCostUsd",
    "costSource",
    "costStatus",
    "pricingVersion",
}


class UsageCollector(Protocol):
    def session(self, session_id: str) -> dict[str, Any]: ...

    def subagents_since(self, started_at: float) -> list[dict[str, Any]]: ...


class HermesCollector:
    """Read usage through the public Hermes session export command."""

    def __init__(self, executable: str = "hermes") -> None:
        resolved = shutil.which(executable)
        if resolved is None:
            raise UsageCollectionError(f"Hermes executable not found: {executable}")
        self.executable = resolved

    def session(self, session_id: str) -> dict[str, Any]:
        sessions = self._export("--session-id", session_id)
        if len(sessions) != 1:
            raise UsageCollectionError(
                f"Expected one Hermes session for {session_id}, found {len(sessions)}"
            )
        return sessions[0]

    def subagents_since(self, started_at: float) -> list[dict[str, Any]]:
        after = datetime.fromtimestamp(started_at, timezone.utc).isoformat()
        return self._export("--after", after, "--source", "subagent")

    def _export(self, *filters: str) -> list[dict[str, Any]]:
        command = [
            self.executable,
            "sessions",
            "export",
            "-",
            "--format",
            "jsonl",
            "--redact",
            *filters,
        ]
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=180,
        )
        if result.returncode != 0:
            error = result.stderr.strip() or "unknown Hermes export error"
            raise UsageCollectionError(error)

        sessions: list[dict[str, Any]] = []
        for line in result.stdout.splitlines():
            stripped = line.strip()
            if not stripped.startswith("{"):
                continue
            try:
                row = json.loads(stripped)
            except json.JSONDecodeError as error:
                raise UsageCollectionError("Hermes returned invalid JSONL") from error
            if isinstance(row, dict):
                sessions.append(row)
        return sessions


def _counter(session: dict[str, Any], key: str) -> int:
    if key not in session:
        raise UsageCollectionError(f"Missing Hermes counter {key}")
    value = session[key]
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise UsageCollectionError(f"Invalid Hermes counter {key}: {value!r}")
    return value


def _usage_from_session(session: dict[str, Any]) -> dict[str, int]:
    usage = {target: _counter(session, source) for source, target in _COUNTERS.items()}
    usage["totalTokens"] = usage["inputTokens"] + usage["outputTokens"]
    return usage


def _usage_delta(start: dict[str, Any], end: dict[str, Any]) -> dict[str, int]:
    usage: dict[str, int] = {}
    for source, target in _COUNTERS.items():
        delta = _counter(end, source) - _counter(start, source)
        if delta < 0:
            raise UsageCollectionError(f"Hermes counter {source} moved backwards")
        usage[target] = delta
    usage["totalTokens"] = usage["inputTokens"] + usage["outputTokens"]
    return usage


def _required_string(session: dict[str, Any], key: str) -> str:
    value = session.get(key)
    if not isinstance(value, str) or _TECHNICAL_METADATA.fullmatch(value) is None:
        raise UsageCollectionError(f"Invalid Hermes metadata {key}: {value!r}")
    return value


def _cost_metadata(session: dict[str, Any]) -> dict[str, str | None]:
    source = session.get("cost_source")
    status = session.get("cost_status")
    version = session.get("pricing_version")
    if (
        source is not None and not isinstance(source, str)
    ) or source not in _COST_SOURCES:
        raise UsageCollectionError(f"Invalid Hermes cost metadata source: {source!r}")
    if (
        status is not None and not isinstance(status, str)
    ) or status not in _COST_STATUSES:
        raise UsageCollectionError(f"Invalid Hermes cost metadata status: {status!r}")
    if version is not None and (
        not isinstance(version, str) or _PRICING_VERSION.fullmatch(version) is None
    ):
        raise UsageCollectionError(
            f"Invalid Hermes cost metadata pricing version: {version!r}"
        )
    return {"source": source, "status": status, "version": version}


def _validated_session_timestamp(
    session: dict[str, Any], key: str, *, optional: bool
) -> str | None:
    value = session.get(key)
    if value is None and optional:
        return None
    rendered = _iso_timestamp(value)
    if rendered is None:
        requirement = "optional numeric epoch or null" if optional else "numeric epoch"
        raise UsageCollectionError(
            f"Invalid Hermes metadata {key}: expected {requirement}"
        )
    return rendered


def _session_metadata(
    session: dict[str, Any], *, require_parent: bool
) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "id": _required_string(session, "id"),
        "source": _required_string(session, "source"),
        "model": _required_string(session, "model"),
        "provider": _required_string(session, "billing_provider"),
        "startedAt": _validated_session_timestamp(
            session, "started_at", optional=False
        ),
        "endedAt": _validated_session_timestamp(session, "ended_at", optional=True),
        "cost": _cost_metadata(session),
        "actualCostUsd": _cost_number(
            session.get("actual_cost_usd"), "actual_cost_usd"
        ),
        "estimatedCostUsd": _cost_number(
            session.get("estimated_cost_usd"), "estimated_cost_usd"
        ),
    }
    if require_parent:
        metadata["parentSessionId"] = _required_string(session, "parent_session_id")
    return metadata


def _agent(
    session: dict[str, Any],
    role: str,
    usage: dict[str, int],
    cost: dict[str, Any],
) -> dict[str, Any]:
    metadata = _session_metadata(session, require_parent=role == "subagent")
    agent = {
        "role": role,
        "sessionId": metadata["id"],
        "model": metadata["model"],
        "provider": metadata["provider"],
        "startedAt": metadata["startedAt"],
        "endedAt": metadata["endedAt"],
        "usage": usage,
        "cost": cost,
    }
    if role == "subagent":
        agent["parentSessionId"] = metadata["parentSessionId"]
    return agent


def _iso_timestamp(value: Any) -> str | None:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    try:
        numeric = float(value)
    except (OverflowError, TypeError, ValueError):
        return None
    if not math.isfinite(numeric) or numeric < 0:
        return None
    try:
        return datetime.fromtimestamp(numeric, timezone.utc).isoformat()
    except (OverflowError, OSError, ValueError):
        return None


def _cost_number(value: Any, key: str) -> float | None:
    if value is None:
        return None
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise UsageCollectionError(f"Hermes cost {key} must be numeric or null")
    try:
        numeric = float(value)
    except (OverflowError, TypeError, ValueError) as error:
        raise UsageCollectionError(
            f"Hermes cost {key} must be a representable number"
        ) from error
    if not math.isfinite(numeric):
        raise UsageCollectionError(f"Hermes cost {key} must be finite")
    if numeric < 0:
        raise UsageCollectionError(f"Hermes cost {key} cannot be negative")
    return numeric


def _cost_delta(start: dict[str, Any], end: dict[str, Any], key: str) -> float | None:
    start_value = _cost_number(start.get(key), key)
    end_value = _cost_number(end.get(key), key)
    if start_value is None or end_value is None:
        return None
    delta = end_value - start_value
    if delta < 0:
        raise UsageCollectionError(f"Hermes cost counter {key} moved backwards")
    return delta


def _cost_component_from_delta(
    start: dict[str, Any], end: dict[str, Any]
) -> dict[str, Any]:
    _cost_metadata(start)
    end_metadata = _cost_metadata(end)
    actual = _cost_delta(start, end, "actual_cost_usd")
    estimated = None
    if end_metadata["source"] not in (None, "none"):
        estimated = _cost_delta(start, end, "estimated_cost_usd")
    if end_metadata["status"] == "included" and end_metadata["source"] in (
        None,
        "none",
    ):
        return {"status": "included", "actualUsd": None, "estimatedUsd": None}
    if actual is not None:
        return {"status": "actual", "actualUsd": actual, "estimatedUsd": None}
    if estimated is not None:
        return {"status": "estimated", "actualUsd": None, "estimatedUsd": estimated}
    return {"status": "unavailable", "actualUsd": None, "estimatedUsd": None}


def _cost_component_from_session(session: dict[str, Any]) -> dict[str, Any]:
    metadata = _cost_metadata(session)
    actual = _cost_number(session.get("actual_cost_usd"), "actual_cost_usd")
    estimated = None
    if metadata["source"] not in (None, "none"):
        estimated = _cost_number(
            session.get("estimated_cost_usd"), "estimated_cost_usd"
        )
    if metadata["status"] == "included" and metadata["source"] in (
        None,
        "none",
    ):
        return {"status": "included", "actualUsd": None, "estimatedUsd": None}
    if actual is not None:
        return {"status": "actual", "actualUsd": actual, "estimatedUsd": None}
    if estimated is not None:
        return {"status": "estimated", "actualUsd": None, "estimatedUsd": estimated}
    return {"status": "unavailable", "actualUsd": None, "estimatedUsd": None}


def _sum_component_costs(
    components: list[dict[str, Any]],
    start: dict[str, Any],
    end: dict[str, Any],
    subagents: list[dict[str, Any]],
) -> dict[str, Any]:
    component_statuses = [component["status"] for component in components]
    statuses = set(component_statuses)
    actual_values = [
        component["actualUsd"]
        for component in components
        if component["actualUsd"] is not None
    ]
    estimated_values = [
        component["estimatedUsd"]
        for component in components
        if component["estimatedUsd"] is not None
    ]
    if len(statuses) == 1:
        status = component_statuses[0]
    elif "unavailable" in statuses:
        status = "partial"
    else:
        status = "mixed"

    metadata = [_cost_metadata(session) for session in [start, end, *subagents]]
    sources = {item["source"] for item in metadata if item["source"] is not None}
    versions = {item["version"] for item in metadata if item["version"] is not None}
    return {
        "currency": "USD",
        "status": status,
        "actualUsd": sum(actual_values) if actual_values else None,
        "estimatedUsd": sum(estimated_values) if estimated_values else None,
        "sources": sorted(sources),
        "pricingVersions": sorted(versions),
        "components": component_statuses,
    }


def _linked_subagents(
    root_session_id: str, subagents: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    sessions_by_id: dict[str, dict[str, Any]] = {}
    children: dict[str, list[dict[str, Any]]] = {}
    for session in subagents:
        metadata = _session_metadata(session, require_parent=True)
        session_id = metadata["id"]
        parent_id = metadata["parentSessionId"]
        if session_id == root_session_id or session_id in sessions_by_id:
            raise UsageCollectionError(
                f"Duplicate or cyclic subagent session: {session_id}"
            )
        sessions_by_id[session_id] = session
        children.setdefault(parent_id, []).append(session)

    for session_id in sessions_by_id:
        visited: set[str] = set()
        current = session_id
        while current in sessions_by_id:
            if current in visited:
                raise UsageCollectionError("Cycle detected in subagent sessions")
            visited.add(current)
            current = sessions_by_id[current]["parent_session_id"]

    linked: list[dict[str, Any]] = []
    queue = deque(children.get(root_session_id, []))
    while queue:
        session = queue.popleft()
        linked.append(session)
        queue.extend(children.get(session["id"], []))
    return linked


def aggregate_usage(
    start: dict[str, Any],
    end: dict[str, Any],
    subagents: list[dict[str, Any]],
    *,
    start_is_validated_snapshot: bool = False,
) -> dict[str, Any]:
    if not start_is_validated_snapshot:
        _session_metadata(start, require_parent=False)
    _session_metadata(end, require_parent=False)
    if start.get("id") != end.get("id"):
        raise UsageCollectionError(
            "Start and end snapshots refer to different sessions"
        )
    if start.get("model") != end.get("model") or start.get(
        "billing_provider"
    ) != end.get("billing_provider"):
        raise UsageCollectionError(
            "Hermes model or provider changed during the measurement"
        )

    root_session_id = _required_string(end, "id")
    linked = _linked_subagents(root_session_id, subagents)
    main_cost = _cost_component_from_delta(start, end)
    subagent_costs = [_cost_component_from_session(session) for session in linked]
    agents = [_agent(end, "main", _usage_delta(start, end), main_cost)]
    agents.extend(
        _agent(session, "subagent", _usage_from_session(session), cost)
        for session, cost in zip(linked, subagent_costs)
    )

    totals = {target: 0 for target in [*_COUNTERS.values(), "totalTokens"]}
    for agent in agents:
        for key in totals:
            totals[key] += agent["usage"][key]

    return {
        "agents": agents,
        "totals": totals,
        "cost": _sum_component_costs([main_cost, *subagent_costs], start, end, linked),
    }


def _validate_work_id(work_id: str) -> None:
    if _SAFE_WORK_ID.fullmatch(work_id) is None:
        raise UsageCollectionError(
            "work-id must contain only letters, numbers, dots, underscores, or hyphens"
        )


def _validate_safe_text(name: str, value: Any, maximum: int) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        raise UsageCollectionError(
            f"{name} must be non-empty without surrounding whitespace"
        )
    normalized = unicodedata.normalize("NFKC", value)
    if _PERCENT_ESCAPE.search(value) or _PERCENT_ESCAPE.search(normalized):
        raise UsageCollectionError(f"{name} contains sensitive-looking encoded content")
    if (
        len(value) > maximum
        or len(normalized) > maximum
        or any(not character.isprintable() for character in value)
    ):
        raise UsageCollectionError(
            f"{name} exceeds its limit or contains control characters"
        )
    if _SENSITIVE_TEXT.search(normalized):
        raise UsageCollectionError(f"{name} contains sensitive-looking content")
    return value


def _validate_record_inputs(
    pr_number: int,
    pr_url: str,
    title: str,
    activities: list[str],
    commit_sha: str,
) -> None:
    if not isinstance(pr_number, int) or isinstance(pr_number, bool) or pr_number <= 0:
        raise UsageCollectionError("pr number must be a positive integer")
    parsed = urlparse(pr_url)
    path_parts = [part for part in parsed.path.split("/") if part]
    if (
        parsed.scheme != "https"
        or parsed.netloc.lower() != "github.com"
        or parsed.params
        or parsed.query
        or parsed.fragment
        or len(path_parts) != 4
        or path_parts[2] != "pull"
        or path_parts[3] != str(pr_number)
    ):
        raise UsageCollectionError(
            "pr-url must be the matching canonical GitHub pull URL"
        )
    _validate_safe_text("title", title, 160)
    if not isinstance(activities, list) or not 1 <= len(activities) <= 10:
        raise UsageCollectionError("activities must contain between 1 and 10 entries")
    for activity in activities:
        _validate_safe_text("activity", activity, 200)
    if not isinstance(commit_sha, str) or _COMMIT_SHA.fullmatch(commit_sha) is None:
        raise UsageCollectionError("commit must be a full lowercase 40-character SHA")


def _snapshot_counter(session: dict[str, Any], key: str) -> int:
    if key not in session:
        raise UsageCollectionError(f"snapshot is missing {key}")
    value = session[key]
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise UsageCollectionError(f"snapshot counter {key} is invalid")
    return value


def _validate_snapshot(snapshot: Any) -> dict[str, Any]:
    if not isinstance(snapshot, dict) or snapshot.get("schemaVersion") != 1:
        raise UsageCollectionError("snapshot schemaVersion is missing or unsupported")
    if (
        not isinstance(snapshot.get("workId"), str)
        or _SAFE_WORK_ID.fullmatch(snapshot["workId"]) is None
    ):
        raise UsageCollectionError("snapshot workId is invalid")
    captured = snapshot.get("capturedAtEpoch")
    captured_iso = _iso_timestamp(captured)
    if captured_iso is None:
        raise UsageCollectionError("snapshot capturedAtEpoch is invalid")
    if snapshot.get("capturedAt") != captured_iso:
        raise UsageCollectionError("snapshot capturedAt is invalid")
    session = snapshot.get("session")
    if not isinstance(session, dict) or not _SNAPSHOT_SESSION_FIELDS.issubset(session):
        raise UsageCollectionError("snapshot session is incomplete")
    for key in ("sessionId", "source", "model", "provider"):
        value = session.get(key)
        if not isinstance(value, str) or _TECHNICAL_METADATA.fullmatch(value) is None:
            raise UsageCollectionError(f"snapshot metadata {key} is invalid")
    for key in _COUNTERS.values():
        _snapshot_counter(session, key)
    total = _snapshot_counter(session, "totalTokens")
    if total != session["inputTokens"] + session["outputTokens"]:
        raise UsageCollectionError("snapshot totalTokens is inconsistent")
    _cost_number(session.get("actualCostUsd"), "snapshot actualCostUsd")
    _cost_number(session.get("estimatedCostUsd"), "snapshot estimatedCostUsd")
    _cost_metadata(
        {
            "cost_source": session.get("costSource"),
            "cost_status": session.get("costStatus"),
            "pricing_version": session.get("pricingVersion"),
        }
    )
    return snapshot


def _read_history_records_strict(history_path: Path) -> list[dict[str, Any]]:
    if not history_path.exists():
        return []
    contents = history_path.read_text(encoding="utf-8")
    if contents and not contents.endswith(("\n", "\r")):
        raise UsageCollectionError(f"Invalid partial JSONL at {history_path}")
    records: list[dict[str, Any]] = []
    for line_number, line in enumerate(contents.splitlines(), start=1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as error:
            raise UsageCollectionError(
                f"Invalid JSONL at {history_path}:{line_number}"
            ) from error
        if not isinstance(record, dict):
            raise UsageCollectionError(
                f"Expected a JSON object at {history_path}:{line_number}"
            )
        pull_request = record.get("pullRequest")
        if not isinstance(pull_request, dict):
            raise UsageCollectionError(
                f"Missing pullRequest object at {history_path}:{line_number}"
            )
        records.append(record)
    return records


def _find_existing_measurement(
    history_path: Path, pr_number: int, work_id: str
) -> dict[str, Any] | None:
    records_by_pr: dict[int, dict[str, Any]] = {}
    records_by_work: dict[str, dict[str, Any]] = {}
    for record in _read_history_records_strict(history_path):
        pull_request = record["pullRequest"]
        existing_pr = pull_request.get("number")
        if (
            not isinstance(existing_pr, int)
            or isinstance(existing_pr, bool)
            or existing_pr <= 0
        ):
            raise UsageCollectionError("Invalid pull request number in history")
        if existing_pr in records_by_pr:
            raise UsageCollectionError(
                f"Corrupt history contains duplicate pull request #{existing_pr}"
            )
        records_by_pr[existing_pr] = record

        existing_work = record.get("workId")
        if existing_work is not None:
            if (
                not isinstance(existing_work, str)
                or _SAFE_WORK_ID.fullmatch(existing_work) is None
            ):
                raise UsageCollectionError("Invalid workId in history")
            if existing_work in records_by_work:
                raise UsageCollectionError(
                    f"Corrupt history contains duplicate workId {existing_work!r}"
                )
            records_by_work[existing_work] = record

    pr_record = records_by_pr.get(pr_number)
    work_record = records_by_work.get(work_id)
    if pr_record is not None and pr_record is work_record:
        return pr_record
    if pr_record is not None:
        raise UsageCollectionError(
            f"Pull request #{pr_number} already exists in history"
        )
    if work_record is not None:
        existing_pr = work_record["pullRequest"].get("number", "?")
        raise UsageCollectionError(
            f"work-id {work_id!r} was already consumed by pull request #{existing_pr}"
        )
    return None


@contextmanager
def _exclusive_lock(lock_path: Path):
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+b") as lock_file:
        lock_file.seek(0, os.SEEK_END)
        if lock_file.tell() == 0:
            lock_file.write(b"0")
            lock_file.flush()
        lock_file.seek(0)
        if os.name == "nt":
            import msvcrt

            msvcrt.locking(lock_file.fileno(), msvcrt.LK_LOCK, 1)
            try:
                yield
            finally:
                lock_file.seek(0)
                msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl

            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def _history_lock_path(history_path: Path) -> Path:
    return history_path.with_name(f"{history_path.name}.lock")


def _find_existing_measurement_locked(
    history_path: Path, pr_number: int, work_id: str
) -> dict[str, Any] | None:
    with _exclusive_lock(_history_lock_path(history_path)):
        return _find_existing_measurement(history_path, pr_number, work_id)


def _append_history_atomic(
    history_path: Path,
    pr_number: int,
    record: dict[str, Any],
) -> dict[str, Any]:
    history_path.parent.mkdir(parents=True, exist_ok=True)
    work_id = str(record["workId"])
    with _exclusive_lock(_history_lock_path(history_path)):
        existing_record = _find_existing_measurement(history_path, pr_number, work_id)
        if existing_record is not None:
            return existing_record
        existing = history_path.read_bytes() if history_path.exists() else b""
        serialized = (
            json.dumps(
                record,
                ensure_ascii=False,
                separators=(",", ":"),
                allow_nan=False,
            ).encode("utf-8")
            + b"\n"
        )
        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="wb",
                dir=history_path.parent,
                prefix=f".{history_path.name}.",
                suffix=".tmp",
                delete=False,
            ) as temporary:
                temporary_path = Path(temporary.name)
                temporary.write(existing)
                temporary.write(serialized)
                temporary.flush()
                os.fsync(temporary.fileno())
            os.replace(temporary_path, history_path)
        finally:
            if temporary_path is not None and temporary_path.exists():
                temporary_path.unlink()
    return record


def _remove_committed_snapshot(snapshot_path: Path) -> None:
    try:
        snapshot_path.unlink(missing_ok=True)
    except OSError as error:
        raise UsageCollectionError(
            "Measurement was committed to history, but snapshot cleanup failed; "
            "retry finish with the same work-id and pull request"
        ) from error


def _snapshot_session(session: dict[str, Any]) -> dict[str, Any]:
    metadata = _session_metadata(session, require_parent=False)
    session_id = metadata["id"]
    source = metadata["source"]
    model = metadata["model"]
    provider = metadata["provider"]
    cost_metadata = metadata["cost"]
    actual_cost = metadata["actualCostUsd"]
    estimated_cost = metadata["estimatedCostUsd"]
    return {
        "sessionId": session_id,
        "source": source,
        "model": model,
        "provider": provider,
        **_usage_from_session(session),
        "actualCostUsd": actual_cost,
        "estimatedCostUsd": estimated_cost,
        "costSource": cost_metadata["source"],
        "costStatus": cost_metadata["status"],
        "pricingVersion": cost_metadata["version"],
    }


def _session_from_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    validated_snapshot = _validate_snapshot(snapshot)
    validated = validated_snapshot["session"]
    inverse = {target: source for source, target in _COUNTERS.items()}
    session = {
        "id": validated["sessionId"],
        "source": validated["source"],
        "model": validated["model"],
        "billing_provider": validated["provider"],
        "actual_cost_usd": validated["actualCostUsd"],
        "estimated_cost_usd": validated["estimatedCostUsd"],
        "cost_source": validated["costSource"],
        "cost_status": validated["costStatus"],
        "pricing_version": validated["pricingVersion"],
    }
    session.update({source: validated[target] for target, source in inverse.items()})
    return session


def start_measurement(
    *,
    work_id: str,
    session_id: str,
    snapshot_path: Path,
    collector: UsageCollector,
    captured_at: float | None = None,
) -> dict[str, Any]:
    _validate_work_id(work_id)
    captured = time.time() if captured_at is None else captured_at
    captured_iso = _iso_timestamp(captured)
    if captured_iso is None:
        raise UsageCollectionError("captured timestamp must be finite and non-negative")
    snapshot = {
        "schemaVersion": 1,
        "workId": work_id,
        "capturedAt": captured_iso,
        "capturedAtEpoch": captured,
        "session": _snapshot_session(collector.session(session_id)),
    }
    serialized = json.dumps(snapshot, indent=2, allow_nan=False) + "\n"
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    created = False
    try:
        with snapshot_path.open("x", encoding="utf-8", newline="\n") as snapshot_file:
            created = True
            snapshot_file.write(serialized)
            snapshot_file.flush()
            os.fsync(snapshot_file.fileno())
    except FileExistsError as error:
        raise UsageCollectionError(
            f"Snapshot already exists: {snapshot_path}"
        ) from error
    except Exception:
        if created and snapshot_path.exists():
            snapshot_path.unlink()
        raise
    return snapshot


def _finish_measurement_locked(
    *,
    work_id: str,
    pr_number: int,
    pr_url: str,
    title: str,
    activities: list[str],
    commit_sha: str,
    snapshot_path: Path,
    history_path: Path,
    collector: UsageCollector,
    captured_at: float | None,
) -> dict[str, Any]:
    if not snapshot_path.exists():
        existing = _find_existing_measurement_locked(history_path, pr_number, work_id)
        if existing is not None:
            return existing
        raise UsageCollectionError(f"Snapshot not found: {snapshot_path}")
    try:
        snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise UsageCollectionError("snapshot contains invalid JSON") from error
    snapshot = _validate_snapshot(snapshot)
    if snapshot["workId"] != work_id:
        raise UsageCollectionError("Snapshot workId does not match")

    existing = _find_existing_measurement_locked(history_path, pr_number, work_id)
    if existing is not None:
        _remove_committed_snapshot(snapshot_path)
        return existing

    end = collector.session(snapshot["session"]["sessionId"])
    subagents = collector.subagents_since(float(snapshot["capturedAtEpoch"]))
    aggregated = aggregate_usage(
        _session_from_snapshot(snapshot),
        end,
        subagents,
        start_is_validated_snapshot=True,
    )
    captured = time.time() if captured_at is None else captured_at
    captured_iso = _iso_timestamp(captured)
    if captured_iso is None:
        raise UsageCollectionError("captured timestamp must be finite and non-negative")
    record = {
        "schemaVersion": 1,
        "measurementStatus": "complete",
        "measurementScope": "development-through-final-local-validation",
        "workId": work_id,
        "pullRequest": {
            "number": pr_number,
            "url": pr_url,
            "title": title,
            "commitSha": commit_sha,
        },
        "startedAt": snapshot["capturedAt"],
        "finishedAt": captured_iso,
        "activities": activities,
        **aggregated,
    }
    committed = _append_history_atomic(history_path, pr_number, record)
    _remove_committed_snapshot(snapshot_path)
    return committed


def finish_measurement(
    *,
    work_id: str,
    pr_number: int,
    pr_url: str,
    title: str,
    activities: list[str],
    commit_sha: str,
    snapshot_path: Path,
    history_path: Path,
    collector: UsageCollector,
    captured_at: float | None = None,
) -> dict[str, Any]:
    _validate_work_id(work_id)
    _validate_record_inputs(pr_number, pr_url, title, activities, commit_sha)
    snapshot_lock = snapshot_path.with_name(f"{snapshot_path.name}.lock")
    with _exclusive_lock(snapshot_lock):
        return _finish_measurement_locked(
            work_id=work_id,
            pr_number=pr_number,
            pr_url=pr_url,
            title=title,
            activities=activities,
            commit_sha=commit_sha,
            snapshot_path=snapshot_path,
            history_path=history_path,
            collector=collector,
            captured_at=captured_at,
        )


def load_history(history_path: Path) -> list[dict[str, Any]]:
    if not history_path.exists():
        return []
    records: list[dict[str, Any]] = []
    for line_number, line in enumerate(
        history_path.read_text(encoding="utf-8").splitlines(), start=1
    ):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as error:
            raise UsageCollectionError(
                f"Invalid JSONL at {history_path}:{line_number}"
            ) from error
        if not isinstance(record, dict):
            raise UsageCollectionError(
                f"Expected a JSON object at {history_path}:{line_number}"
            )
        records.append(record)
    return records


def render_report(records: list[dict[str, Any]]) -> str:
    lines = ["PR\tMeasurement\tTotal tokens\tInput\tOutput\tCache read\tCost\tTitle"]
    for record in records:
        pull_request = record.get("pullRequest", {})
        totals = record.get("totals") or {}
        cost = record.get("cost") or {}
        cost_parts: list[str] = []
        if cost.get("actualUsd") is not None:
            cost_parts.append(f"actual USD {float(cost['actualUsd']):.6f}")
        if cost.get("estimatedUsd") is not None:
            cost_parts.append(f"estimated USD {float(cost['estimatedUsd']):.6f}")
        cost_status = str(cost.get("status", "unavailable"))
        cost_parts.append(cost_status)
        cost_display = "; ".join(cost_parts)
        values = [
            f"#{pull_request.get('number', '?')}",
            str(record.get("measurementStatus", "unknown")),
            str(totals.get("totalTokens", "n/a")),
            str(totals.get("inputTokens", "n/a")),
            str(totals.get("outputTokens", "n/a")),
            str(totals.get("cacheReadTokens", "n/a")),
            cost_display,
            str(pull_request.get("title", "")).replace("\t", " ").replace("\n", " "),
        ]
        lines.append("\t".join(values))
    return "\n".join(lines)


def _snapshot_path(snapshot_dir: Path, work_id: str) -> Path:
    return snapshot_dir / f"{work_id}.json"


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    start = subparsers.add_parser("start", help="capture sanitized starting counters")
    start.add_argument("--work-id", required=True)
    start.add_argument("--session-id", required=True)
    start.add_argument("--snapshot-dir", type=Path, default=Path(".ai-usage"))

    finish = subparsers.add_parser("finish", help="append one PR usage record")
    finish.add_argument("--work-id", required=True)
    finish.add_argument("--pr", type=int, required=True)
    finish.add_argument("--pr-url", required=True)
    finish.add_argument("--title", required=True)
    finish.add_argument("--activity", action="append", required=True)
    finish.add_argument("--commit", required=True)
    finish.add_argument("--snapshot-dir", type=Path, default=Path(".ai-usage"))
    finish.add_argument(
        "--history",
        type=Path,
        default=Path("docs/engineering/ai-usage/pr-costs.jsonl"),
    )
    report = subparsers.add_parser("report", help="print a tabular PR usage report")
    report.add_argument(
        "--history",
        type=Path,
        default=Path("docs/engineering/ai-usage/pr-costs.jsonl"),
    )
    return parser


def main() -> int:
    args = _parser().parse_args()
    try:
        if args.command == "report":
            print(render_report(load_history(args.history)))
            return 0

        collector = HermesCollector()
        snapshot_path = _snapshot_path(args.snapshot_dir, args.work_id)
        if args.command == "start":
            snapshot = start_measurement(
                work_id=args.work_id,
                session_id=args.session_id,
                snapshot_path=snapshot_path,
                collector=collector,
            )
            print(
                f"Started usage measurement at {snapshot['capturedAt']}: {snapshot_path}"
            )
        else:
            record = finish_measurement(
                work_id=args.work_id,
                pr_number=args.pr,
                pr_url=args.pr_url,
                title=args.title,
                activities=args.activity,
                commit_sha=args.commit,
                snapshot_path=snapshot_path,
                history_path=args.history,
                collector=collector,
            )
            print(json.dumps(record["totals"], ensure_ascii=False))
    except (OSError, KeyError, TypeError, ValueError, UsageCollectionError) as error:
        print(f"error: {error}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
