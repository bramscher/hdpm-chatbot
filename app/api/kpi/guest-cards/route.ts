import { NextResponse } from 'next/server';
import { fetchGuestCardKpi } from '@/lib/appfolio-kpi';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const data = await fetchGuestCardKpi();

    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('kpi_snapshots').insert({
        kpi_name: 'guest_cards',
        value: data,
      });
    } catch (e) {
      console.warn('[KPI] Failed to save guest cards snapshot:', e);
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('[KPI] Guest cards error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch guest card data' },
      { status: 500 }
    );
  }
}
