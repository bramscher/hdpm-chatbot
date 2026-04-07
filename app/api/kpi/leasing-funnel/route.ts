import { NextResponse } from 'next/server';
import { fetchLeasingFunnelKpi } from '@/lib/appfolio-kpi';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const data = await fetchLeasingFunnelKpi();

    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('kpi_snapshots').insert({
        kpi_name: 'leasing_funnel',
        value: data,
      });
    } catch (e) {
      console.warn('[KPI] Failed to save leasing funnel snapshot:', e);
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('[KPI] Leasing funnel error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch leasing funnel data' },
      { status: 500 }
    );
  }
}
