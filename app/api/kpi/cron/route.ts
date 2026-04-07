import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  fetchDelinquencyKpi,
  fetchVacancyKpi,
  fetchWorkOrderKpi,
  fetchNoticeKpi,
  fetchInsuranceKpi,
  fetchOwnerRetentionKpi,
  fetchMaintenanceCostKpi,
  fetchDaysToLeaseKpi,
  fetchLeaseRenewalKpi,
  fetchNetDoorsKpi,
} from '@/lib/appfolio-kpi';

/**
 * POST /api/kpi/cron
 *
 * Daily cron job (7 AM PT / 14:00 UTC) that snapshots all 10 KPIs
 * into kpi_snapshots for historical trend tracking.
 *
 * Protected by CRON_SECRET (same pattern as /api/sync/appfolio).
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[KPI Cron] Starting daily snapshot...');
  const supabase = getSupabaseAdmin();
  const results: Record<string, { success: boolean; error?: string }> = {};

  const kpiFetchers = [
    { name: 'delinquency', fn: fetchDelinquencyKpi },
    { name: 'vacancy', fn: fetchVacancyKpi },
    { name: 'work_orders', fn: fetchWorkOrderKpi },
    { name: 'notices', fn: fetchNoticeKpi },
    { name: 'insurance', fn: fetchInsuranceKpi },
    { name: 'owner_retention', fn: fetchOwnerRetentionKpi },
    { name: 'maintenance_cost', fn: fetchMaintenanceCostKpi },
    { name: 'days_to_lease', fn: fetchDaysToLeaseKpi },
    { name: 'lease_renewal', fn: fetchLeaseRenewalKpi },
    { name: 'net_doors', fn: fetchNetDoorsKpi },
  ] as const;

  await Promise.allSettled(
    kpiFetchers.map(async ({ name, fn }) => {
      try {
        const value = await fn();
        const { error } = await supabase
          .from('kpi_snapshots')
          .insert({ kpi_name: name, value });

        if (error) throw new Error(error.message);
        results[name] = { success: true };
        console.log(`[KPI Cron] ${name}: OK`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results[name] = { success: false, error: msg };
        console.error(`[KPI Cron] ${name}: FAILED -`, msg);
      }
    })
  );

  const succeeded = Object.values(results).filter((r) => r.success).length;
  console.log(`[KPI Cron] Done: ${succeeded}/10 snapshots saved`);

  return NextResponse.json({ results, succeeded, total: 10 });
}

export const maxDuration = 300;
