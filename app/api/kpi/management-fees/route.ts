import { NextResponse } from 'next/server';
import { fetchManagementFeesKpi } from '@/lib/appfolio-kpi';
import { getSupabaseAdmin } from '@/lib/supabase';

export const maxDuration = 120;

export async function GET() {
  try {
    const data = await fetchManagementFeesKpi();

    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('kpi_snapshots').insert({
        kpi_name: 'management_fees',
        value: data,
      });
    } catch (e) {
      console.warn('[KPI] Failed to save management fees snapshot:', e);
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('[KPI] Management fees error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch management fees data' },
      { status: 500 }
    );
  }
}
