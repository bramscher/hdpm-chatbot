import { NextResponse } from 'next/server';
import { fetchDelinquencyKpi } from '@/lib/appfolio-kpi';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const data = await fetchDelinquencyKpi();

    // Snapshot to Supabase for week-over-week trends
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('kpi_snapshots').insert({
        kpi_name: 'delinquency',
        value: data,
      });
    } catch (e) {
      console.warn('[KPI] Failed to save delinquency snapshot:', e);
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('[KPI] Delinquency error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch delinquency data' },
      { status: 500 }
    );
  }
}
