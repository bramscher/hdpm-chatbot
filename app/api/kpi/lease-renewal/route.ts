import { NextResponse } from 'next/server';
import { fetchLeaseRenewalKpi } from '@/lib/appfolio-kpi';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const data = await fetchLeaseRenewalKpi();

    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('kpi_snapshots').insert({
        kpi_name: 'lease_renewal',
        value: data,
      });
    } catch (e) {
      console.warn('[KPI] Failed to save lease renewal snapshot:', e);
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('[KPI] Lease renewal error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch lease renewal data' },
      { status: 500 }
    );
  }
}
