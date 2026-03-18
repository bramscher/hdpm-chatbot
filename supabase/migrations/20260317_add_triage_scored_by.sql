-- Track whether triage recommendation came from rules or AI
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS triage_scored_by TEXT;
