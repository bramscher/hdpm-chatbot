-- Migration: Create inspection management tables
-- Date: 2026-03-19
-- Description: Core tables for property inspections, route planning, and audit logging

-- =============================================================================
-- 1. TRIGGER FUNCTION: auto-update updated_at timestamp
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 2. inspection_properties - Properties needing inspections
-- =============================================================================

CREATE TABLE inspection_properties (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id       TEXT,
  name              TEXT,
  address_1         TEXT NOT NULL,
  address_2         TEXT,
  city              TEXT NOT NULL,
  state             TEXT DEFAULT 'OR',
  zip               TEXT NOT NULL,
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  geocode_status    TEXT DEFAULT 'pending',
  region            TEXT,
  owner_name        TEXT,
  unit_count        INTEGER DEFAULT 1,
  active            BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inspection_properties_city ON inspection_properties (city);
CREATE INDEX idx_inspection_properties_region ON inspection_properties (region);
CREATE UNIQUE INDEX idx_inspection_properties_address ON inspection_properties (address_1, city, zip);

CREATE TRIGGER trg_inspection_properties_updated_at
  BEFORE UPDATE ON inspection_properties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- 3. route_plans - Planned inspection routes (must precede inspections & route_stops)
-- =============================================================================

CREATE TABLE route_plans (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_date                DATE NOT NULL,
  assigned_to               TEXT NOT NULL,
  start_address             TEXT DEFAULT '1515 SW Reindeer Ave, Redmond, OR 97756',
  end_address               TEXT,
  total_stops               INTEGER DEFAULT 0,
  total_drive_minutes       INTEGER,
  total_service_minutes     INTEGER,
  total_estimated_minutes   INTEGER,
  status                    TEXT DEFAULT 'draft',
  notes                     TEXT,
  optimization_method       TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_route_plans_route_date ON route_plans (route_date);
CREATE INDEX idx_route_plans_assigned_to ON route_plans (assigned_to);

CREATE TRIGGER trg_route_plans_updated_at
  BEFORE UPDATE ON route_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- 4. import_batches - File upload audit trail (must precede inspections)
-- =============================================================================

CREATE TABLE import_batches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename          TEXT NOT NULL,
  file_type         TEXT,
  total_rows        INTEGER,
  valid_rows        INTEGER,
  invalid_rows      INTEGER,
  duplicate_rows    INTEGER,
  column_mapping    JSONB,
  status            TEXT DEFAULT 'pending',
  error_message     TEXT,
  uploaded_by       TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 5. inspections - Individual inspection tasks
-- =============================================================================

CREATE TABLE inspections (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id                 UUID REFERENCES inspection_properties (id),
  inspection_type             TEXT NOT NULL,
  description                 TEXT,
  due_date                    DATE,
  target_date                 DATE,
  preferred_window            TEXT,
  priority                    TEXT DEFAULT 'normal',
  priority_score              INTEGER DEFAULT 50,
  estimated_duration_minutes  INTEGER DEFAULT 30,
  occupancy_status            TEXT DEFAULT 'occupied',
  unit_name                   TEXT,
  resident_name               TEXT,
  last_inspection_date        DATE,
  notes                       TEXT,
  internal_tags               TEXT[],
  assigned_to                 TEXT,
  route_plan_id               UUID REFERENCES route_plans (id) ON DELETE SET NULL,
  status                      TEXT DEFAULT 'imported',
  completed_at                TIMESTAMPTZ,
  completed_by                TEXT,
  completion_notes            TEXT,
  issues_found                BOOLEAN DEFAULT FALSE,
  issue_severity              TEXT,
  followup_wo_id              TEXT,
  import_batch_id             UUID REFERENCES import_batches (id),
  import_row_number           INTEGER,
  appfolio_task_id            TEXT,
  meld_id                     TEXT,
  sync_status                 TEXT DEFAULT 'not_synced',
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inspections_property_id ON inspections (property_id);
CREATE INDEX idx_inspections_status ON inspections (status);
CREATE INDEX idx_inspections_due_date ON inspections (due_date);
CREATE INDEX idx_inspections_assigned_to ON inspections (assigned_to);
CREATE INDEX idx_inspections_route_plan_id ON inspections (route_plan_id);
CREATE INDEX idx_inspections_import_batch_id ON inspections (import_batch_id);

CREATE TRIGGER trg_inspections_updated_at
  BEFORE UPDATE ON inspections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- 6. route_stops - Ordered stops within routes
-- =============================================================================

CREATE TABLE route_stops (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_plan_id                 UUID NOT NULL REFERENCES route_plans (id) ON DELETE CASCADE,
  inspection_id                 UUID NOT NULL REFERENCES inspections (id) ON DELETE CASCADE,
  stop_order                    INTEGER NOT NULL,
  estimated_arrival             TIMESTAMPTZ,
  estimated_departure           TIMESTAMPTZ,
  travel_minutes_from_previous  INTEGER,
  service_minutes               INTEGER DEFAULT 30,
  status                        TEXT DEFAULT 'pending',
  actual_arrival                TIMESTAMPTZ,
  actual_departure              TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_route_stops_route_plan_id ON route_stops (route_plan_id);
CREATE INDEX idx_route_stops_inspection_id ON route_stops (inspection_id);
CREATE UNIQUE INDEX idx_route_stops_plan_order ON route_stops (route_plan_id, stop_order);

-- =============================================================================
-- 7. inspection_audit_log - Immutable change log
-- =============================================================================

CREATE TABLE inspection_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  action          TEXT NOT NULL,
  old_value       JSONB,
  new_value       JSONB,
  performed_by    TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_entity ON inspection_audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_log_action ON inspection_audit_log (action);
