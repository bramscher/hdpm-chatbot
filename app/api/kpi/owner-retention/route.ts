import { NextResponse } from 'next/server';
import { fetchOwnerRetentionKpi } from '@/lib/appfolio-kpi';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const data = await fetchOwnerRetentionKpi();

    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('kpi_snapshots').insert({
        kpi_name: 'owner_retention',
        value: data,
      });
    } catch (e) {
      console.warn('[KPI] Failed to save owner retention snapshot:', e);
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('[KPI] Owner retention error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch owner retention data' },
      { status: 500 }
    );
  }
}
