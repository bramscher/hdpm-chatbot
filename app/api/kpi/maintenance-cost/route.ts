import { NextResponse } from 'next/server';
import { fetchMaintenanceCostKpi } from '@/lib/appfolio-kpi';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const data = await fetchMaintenanceCostKpi();

    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('kpi_snapshots').insert({
        kpi_name: 'maintenance_cost',
        value: data,
      });
    } catch (e) {
      console.warn('[KPI] Failed to save maintenance cost snapshot:', e);
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('[KPI] Maintenance cost error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch maintenance cost data' },
      { status: 500 }
    );
  }
}
