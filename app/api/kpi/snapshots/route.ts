import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Returns the most recent prior snapshot for each KPI (before today).
 * Used by the dashboard to compute week-over-week deltas.
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const kpiNames = ['delinquency', 'vacancy', 'work_orders', 'notices', 'insurance'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snapshots: Record<string, Record<string, unknown>> = {};

    await Promise.all(
      kpiNames.map(async (name) => {
        const { data } = await supabase
          .from('kpi_snapshots')
          .select('value, captured_at')
          .eq('kpi_name', name)
          .lt('captured_at', today.toISOString())
          .order('captured_at', { ascending: false })
          .limit(1)
          .single();

        if (data) {
          snapshots[name] = data.value as Record<string, unknown>;
        }
      })
    );

    return NextResponse.json(snapshots, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('[KPI] Snapshots error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}
