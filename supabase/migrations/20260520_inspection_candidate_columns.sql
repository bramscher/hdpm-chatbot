-- Migration: Add AppFolio candidate-flow columns to inspection_properties
-- Date: 2026-05-20
-- Description: Extends inspection_properties with AppFolio identity + classification fields
-- so the candidate sync can upsert one row per unit and the candidates UI can filter by
-- status (skip_recent / defer / eligible / scheduled / dismissed).

ALTER TABLE inspection_properties
  ADD COLUMN IF NOT EXISTS appfolio_property_id        TEXT,
  ADD COLUMN IF NOT EXISTS appfolio_unit_id            TEXT,
  ADD COLUMN IF NOT EXISTS uses_custom_inspection_date BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_inspection_date        DATE,
  ADD COLUMN IF NOT EXISTS candidate_status            TEXT,
  ADD COLUMN IF NOT EXISTS local_skip_reason           TEXT,
  ADD COLUMN IF NOT EXISTS local_skip_set_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_appfolio_sync_at       TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inspection_properties_appfolio_unit
  ON inspection_properties (appfolio_unit_id)
  WHERE appfolio_unit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inspection_properties_appfolio_property
  ON inspection_properties (appfolio_property_id)
  WHERE appfolio_property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inspection_properties_candidate_status
  ON inspection_properties (candidate_status)
  WHERE candidate_status IS NOT NULL;
