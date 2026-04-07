-- KPI Snapshots: stores weekly operational metrics for trend tracking
-- Run this migration manually in Supabase SQL editor

CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  kpi_name text NOT NULL,
  value jsonb NOT NULL,
  captured_at timestamptz DEFAULT now()
);

-- Index for efficient lookups by KPI name + time
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_name_time
  ON kpi_snapshots (kpi_name, captured_at DESC);
