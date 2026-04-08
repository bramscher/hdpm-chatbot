import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

interface SnapshotRow {
  kpi_name: string;
  value: Record<string, number>;
  captured_at: string;
}

/**
 * GET /api/kpi/trends?range=4w|8w|12w|6m
 *
 * Returns deduplicated daily snapshots for all KPIs within the date range.
 * One data point per KPI per day (latest snapshot that day).
 */
export async function GET(request: NextRequest) {
  try {
    const range = request.nextUrl.searchParams.get('range') || '8w';

    const now = new Date();
    const startDate = new Date(now);
    switch (range) {
      case '4w':
        startDate.setDate(startDate.getDate() - 28);
        break;
      case '12w':
        startDate.setDate(startDate.getDate() - 84);
        break;
      case '6m':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'all':
        startDate.setFullYear(2020);
        break;
      default: // 8w
        startDate.setDate(startDate.getDate() - 56);
        break;
    }

    const supabase = getSupabaseAdmin();

    // Supabase JS defaults to 1000 rows. For 12 KPIs × 156 weeks = 1872 rows,
    // we need to explicitly set a higher limit for longer ranges.
    const rowLimit = range === 'all' ? 5000 : range === '1y' ? 2000 : 1000;

    const { data: rows, error } = await supabase
      .from('kpi_snapshots')
      .select('kpi_name, value, captured_at')
      .gte('captured_at', startDate.toISOString())
      .order('captured_at', { ascending: true })
      .limit(rowLimit);

    if (error) {
      throw new Error(error.message);
    }

    // Deduplicate: keep only the latest snapshot per KPI per day
    const byKpi: Record<string, Map<string, SnapshotRow>> = {};

    for (const row of (rows || []) as SnapshotRow[]) {
      const dateKey = row.captured_at.substring(0, 10); // YYYY-MM-DD
      if (!byKpi[row.kpi_name]) {
        byKpi[row.kpi_name] = new Map();
      }
      // Later entries overwrite earlier ones for the same day
      byKpi[row.kpi_name].set(dateKey, row);
    }

    // Transform to chart-ready arrays
    const trends: Record<string, Array<{ date: string; value: Record<string, number> }>> = {};

    for (const [kpiName, dateMap] of Object.entries(byKpi)) {
      trends[kpiName] = Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, row]) => ({
          date,
          value: row.value,
        }));
    }

    return NextResponse.json(trends, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('[KPI] Trends error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}
