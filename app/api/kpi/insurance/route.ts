import { NextResponse } from 'next/server';
import { fetchInsuranceKpi } from '@/lib/appfolio-kpi';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const data = await fetchInsuranceKpi();

    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('kpi_snapshots').insert({
        kpi_name: 'insurance',
        value: data,
      });
    } catch (e) {
      console.warn('[KPI] Failed to save insurance snapshot:', e);
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('[KPI] Insurance error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch insurance data' },
      { status: 500 }
    );
  }
}
