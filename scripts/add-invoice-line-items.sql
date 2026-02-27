-- ============================================
-- Migration: Add line_items and work_order_id to hdms_invoices
-- Run this in the Supabase SQL Editor
-- ============================================

-- Step 1: Add line_items JSONB column for structured billing data
-- Each line item: { "description": "...", "account": "...", "amount": 90.50 }
ALTER TABLE hdms_invoices
  ADD COLUMN IF NOT EXISTS line_items JSONB DEFAULT NULL;

-- Step 2: Add work_order_id FK to link invoices to synced work orders
-- (Only add if work_orders table exists from create-work-orders.sql)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_orders') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'hdms_invoices' AND column_name = 'work_order_id'
    ) THEN
      ALTER TABLE hdms_invoices
        ADD COLUMN work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL;
    END IF;
  ELSE
    -- If work_orders table doesn't exist yet, add as plain UUID (no FK)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'hdms_invoices' AND column_name = 'work_order_id'
    ) THEN
      ALTER TABLE hdms_invoices ADD COLUMN work_order_id UUID;
    END IF;
  END IF;
END $$;

-- Step 3: Index for work_order_id lookups
CREATE INDEX IF NOT EXISTS idx_hdms_invoices_work_order_id
  ON hdms_invoices(work_order_id)
  WHERE work_order_id IS NOT NULL;

-- ============================================
-- Verification
-- ============================================

-- Check columns were added:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'hdms_invoices' AND column_name IN ('line_items', 'work_order_id');

-- Test line_items insert:
-- UPDATE hdms_invoices
-- SET line_items = '[{"description": "Rekey locks", "account": "6500: Keys", "amount": 90.50}]'::jsonb
-- WHERE id = '<some-id>';
