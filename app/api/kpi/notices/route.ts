import { NextResponse } from 'next/server';
import { fetchNoticeKpi } from '@/lib/appfolio-kpi';
import { getSupabaseAdmin } from '@/lib/supabase';

export const maxDuration = 120;

export async function GET() {
  try {
    const data = await fetchNoticeKpi();

    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('kpi_snapshots').insert({
        kpi_name: 'notices',
        value: data,
      });
    } catch (e) {
      console.warn('[KPI] Failed to save notices snapshot:', e);
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('[KPI] Notices error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch notice data' },
      { status: 500 }
    );
  }
}
