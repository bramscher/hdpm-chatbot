import { NextResponse } from 'next/server';
import { fetchDaysToLeaseKpi } from '@/lib/appfolio-kpi';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const data = await fetchDaysToLeaseKpi();

    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('kpi_snapshots').insert({
        kpi_name: 'days_to_lease',
        value: data,
      });
    } catch (e) {
      console.warn('[KPI] Failed to save days to lease snapshot:', e);
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('[KPI] Days to lease error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch days to lease data' },
      { status: 500 }
    );
  }
}
