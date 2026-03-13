-- Short-link table for rent analysis report URLs
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS report_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  short_id text NOT NULL UNIQUE,
  file_path text NOT NULL,
  property_address text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_by text
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_report_links_short_id ON report_links (short_id);

-- Enable RLS
ALTER TABLE report_links ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (server-side only)
CREATE POLICY "Service role full access" ON report_links
  FOR ALL
  USING (true)
  WITH CHECK (true);
