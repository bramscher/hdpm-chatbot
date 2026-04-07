import { NextResponse } from 'next/server';
import { fetchWorkOrderKpi } from '@/lib/appfolio-kpi';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const data = await fetchWorkOrderKpi();

    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('kpi_snapshots').insert({
        kpi_name: 'work_orders',
        value: data,
      });
    } catch (e) {
      console.warn('[KPI] Failed to save work orders snapshot:', e);
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('[KPI] Work orders error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch work order data' },
      { status: 500 }
    );
  }
}
