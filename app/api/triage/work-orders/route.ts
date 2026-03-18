import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/triage/work-orders
 *
 * Fetch ALL open work orders with triage columns — no row limit.
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email?.endsWith('@highdesertpm.com')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('work_orders')
      .select(
        'id, wo_number, property_name, property_address, unit_name, description, vendor_name, vendor_id, scheduled_start, created_at, updated_at, triage_recommendation, triage_reason, triage_action_taken, triage_scored_by'
      )
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching triage work orders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workOrders: data || [] });
  } catch (error) {
    console.error('Triage work orders error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
