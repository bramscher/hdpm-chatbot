-- Add Property Meld integration columns to inspection_properties
ALTER TABLE inspection_properties ADD COLUMN IF NOT EXISTS pm_property_id integer;
ALTER TABLE inspection_properties ADD COLUMN IF NOT EXISTS pm_unit_id integer;
ALTER TABLE inspection_properties ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- Index for fast PM lookups during sync
CREATE INDEX IF NOT EXISTS idx_inspection_properties_pm_ids
  ON inspection_properties (pm_property_id, pm_unit_id);

-- Update existing inspection types from annual to biannual
UPDATE inspections SET inspection_type = 'biannual' WHERE inspection_type = 'annual';

-- Add last_inspection_date column (from AppFolio LastInspectedDate)
ALTER TABLE inspection_properties ADD COLUMN IF NOT EXISTS last_inspection_date date;

-- Drop old move_in_date if it exists (replaced by last_inspection_date)
-- ALTER TABLE inspection_properties DROP COLUMN IF EXISTS move_in_date;
