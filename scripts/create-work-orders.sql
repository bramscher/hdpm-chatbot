-- ============================================
-- Migration: Work Orders (AppFolio Sync)
-- Run this in the Supabase SQL Editor
-- ============================================

-- Work orders table
CREATE TABLE IF NOT EXISTS work_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- AppFolio identity
  appfolio_id TEXT UNIQUE NOT NULL,

  -- Property info
  property_id TEXT,
  property_name TEXT NOT NULL,
  property_address TEXT,
  unit_id TEXT,
  unit_name TEXT,

  -- Work order details
  wo_number TEXT,
  description TEXT NOT NULL,
  category TEXT,
  priority TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'done')),
  appfolio_status TEXT,

  -- Assignment
  assigned_to TEXT,
  vendor_id TEXT,

  -- Scheduling
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  canceled_date TIMESTAMPTZ,

  -- Permissions
  permission_to_enter BOOLEAN DEFAULT false,

  -- Audit
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_property_id ON work_orders(property_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_work_orders_completed_date ON work_orders(completed_date DESC);
CREATE INDEX IF NOT EXISTS idx_work_orders_synced_at ON work_orders(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_orders_created_at ON work_orders(created_at DESC);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_work_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_work_order_timestamp ON work_orders;
CREATE TRIGGER trigger_update_work_order_timestamp
  BEFORE UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_work_order_timestamp();

-- RLS policies (using service role, so permissive)
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to work_orders" ON work_orders
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON work_orders TO service_role;

-- ============================================
-- Add FK column to hdms_invoices for linking
-- ============================================

ALTER TABLE hdms_invoices
  ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES work_orders(id);

CREATE INDEX IF NOT EXISTS idx_hdms_invoices_work_order_id
  ON hdms_invoices(work_order_id);
