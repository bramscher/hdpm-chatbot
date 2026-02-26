-- ============================================
-- Migration: HDMS Invoice Generator
-- Run this in the Supabase SQL Editor
-- ============================================

-- Step 1: Create a PostgreSQL SEQUENCE for atomic invoice numbering
CREATE SEQUENCE IF NOT EXISTS hdms_invoice_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- Step 2: Create the hdms_invoices table
CREATE TABLE IF NOT EXISTS hdms_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number INTEGER NOT NULL UNIQUE DEFAULT nextval('hdms_invoice_number_seq'),
  invoice_code TEXT GENERATED ALWAYS AS ('HDMS-INV-' || LPAD(invoice_number::text, 6, '0')) STORED,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'attached', 'void')),

  -- Property info
  property_name TEXT NOT NULL,
  property_address TEXT NOT NULL,

  -- Work order reference
  wo_reference TEXT,
  completed_date DATE,

  -- Invoice content
  description TEXT NOT NULL,
  labor_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  materials_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Internal
  internal_notes TEXT,
  pdf_path TEXT,

  -- Audit
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_hdms_invoices_status ON hdms_invoices(status);
CREATE INDEX IF NOT EXISTS idx_hdms_invoices_created_by ON hdms_invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_hdms_invoices_created_at ON hdms_invoices(created_at DESC);

-- Step 4: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_hdms_invoice_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_hdms_invoice_timestamp ON hdms_invoices;
CREATE TRIGGER trigger_update_hdms_invoice_timestamp
  BEFORE UPDATE ON hdms_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_hdms_invoice_timestamp();

-- Step 5: RLS policies (using service role, so permissive)
ALTER TABLE hdms_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to invoices" ON hdms_invoices
  FOR ALL USING (true) WITH CHECK (true);

-- Step 6: Grant access
GRANT ALL ON hdms_invoices TO service_role;
GRANT USAGE, SELECT ON SEQUENCE hdms_invoice_number_seq TO service_role;

-- ============================================
-- Supabase Storage: Create bucket manually
-- ============================================
-- In Supabase Dashboard > Storage > New Bucket:
--   Name: hdms-invoices
--   Public: OFF (private bucket)
--   File size limit: 10MB
--   Allowed MIME types: application/pdf

-- ============================================
-- Verification: Run these after the migration
-- ============================================

-- Check that the table was created:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'hdms_invoices' ORDER BY ordinal_position;

-- Test insert:
-- INSERT INTO hdms_invoices (property_name, property_address, description, labor_amount, materials_amount, total_amount, created_by)
-- VALUES ('Test Property', '123 Test St', 'Test work', 100.00, 50.00, 150.00, 'test@highdesertpm.com')
-- RETURNING id, invoice_number, invoice_code, status;

-- Check sequence:
-- SELECT last_value FROM hdms_invoice_number_seq;
