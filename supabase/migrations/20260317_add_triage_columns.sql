-- Add triage columns to the existing work_orders table
-- Run this in the Supabase SQL editor before using the triage dashboard

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS triage_recommendation TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS triage_reason TEXT,
  ADD COLUMN IF NOT EXISTS triage_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS triage_action_taken TEXT,
  ADD COLUMN IF NOT EXISTS triage_was_overridden BOOLEAN DEFAULT FALSE;
