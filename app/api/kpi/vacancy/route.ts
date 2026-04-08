import { NextResponse } from 'next/server';
import { fetchVacancyKpi } from '@/lib/appfolio-kpi';
import { getSupabaseAdmin } from '@/lib/supabase';

export const maxDuration = 120;

export async function GET() {
  try {
    const data = await fetchVacancyKpi();

    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('kpi_snapshots').insert({
        kpi_name: 'vacancy',
        value: data,
      });
    } catch (e) {
      console.warn('[KPI] Failed to save vacancy snapshot:', e);
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('[KPI] Vacancy error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch vacancy data' },
      { status: 500 }
    );
  }
}
