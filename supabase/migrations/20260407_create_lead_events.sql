-- Lead Events: real-time lead webhook cache for fast KPI 11 lookups
-- Run this migration manually in Supabase SQL editor

CREATE TABLE IF NOT EXISTS lead_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  appfolio_lead_id text NOT NULL,
  source_raw text,
  source_normalized text,
  property_id text,
  status text,
  created_at timestamptz NOT NULL,
  received_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_events_created
  ON lead_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_events_received
  ON lead_events (received_at DESC);
