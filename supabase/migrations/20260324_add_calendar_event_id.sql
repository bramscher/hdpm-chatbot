-- Migration: Add calendar_event_id to route_plans
-- Date: 2026-03-24
-- Description: Store Outlook calendar event ID for cleanup on route deletion

ALTER TABLE route_plans
  ADD COLUMN calendar_event_id TEXT;
