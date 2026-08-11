ALTER TABLE weekly_plan_entries
    ADD COLUMN planned_quantity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE weekly_plan_entries
    ADD CONSTRAINT ck_weekly_plan_entries_planned_quantity
        CHECK (planned_quantity BETWEEN 1 AND 100);
