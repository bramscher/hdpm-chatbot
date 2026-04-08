import { NextResponse } from 'next/server';
import { fetchNetDoorsKpi } from '@/lib/appfolio-kpi';
import { getSupabaseAdmin } from '@/lib/supabase';

export const maxDuration = 120;

export async function GET() {
  try {
    const data = await fetchNetDoorsKpi();

    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('kpi_snapshots').insert({
        kpi_name: 'net_doors',
        value: data,
      });
    } catch (e) {
      console.warn('[KPI] Failed to save net doors snapshot:', e);
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('[KPI] Net doors error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch net doors data' },
      { status: 500 }
    );
  }
}
