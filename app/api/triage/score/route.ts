import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/triage/score
 *
 * Evaluate all open work orders (where triage_action_taken IS NULL)
 * against the four scoring rules and write recommendations back.
 */

type Recommendation = 'close' | 'finish' | 'migrate' | 'pending';

interface ScoredRow {
  id: string;
  triage_recommendation: Recommendation;
  triage_reason: string;
}

export async function POST() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email?.endsWith('@highdesertpm.com')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch all open work orders that haven't been actioned yet
    const { data: workOrders, error: fetchError } = await supabase
      .from('work_orders')
      .select('id, status, vendor_id, vendor_name, scheduled_start, updated_at, created_at')
      .eq('status', 'open')
      .is('triage_action_taken', null);

    if (fetchError) {
      console.error('Error fetching work orders for scoring:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const rows = workOrders || [];
    const now = new Date();

    // Count already-actioned tickets (for the skipped count)
    const { count: actionedCount, error: countError } = await supabase
      .from('work_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .not('triage_action_taken', 'is', null);

    if (countError) {
      console.error('Error counting actioned work orders:', countError);
    }

    const summary = { close: 0, finish: 0, migrate: 0, pending: 0, skipped: actionedCount ?? 0 };

    // Score each work order
    const updates: ScoredRow[] = rows.map((wo) => {
      const lastUpdated = wo.updated_at ? new Date(wo.updated_at) : new Date(wo.created_at);
      const daysSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));

      const hasVendor = !!wo.vendor_id;
      const hasSchedule = !!wo.scheduled_start;

      let recommendation: Recommendation;
      let reason: string;

      // Rule 1 — Stale / No Activity (→ Close)
      if (daysSinceUpdate > 90 && !hasSchedule && !hasVendor) {
        recommendation = 'close';
        reason = `No activity in ${daysSinceUpdate} days — likely abandoned`;
      }
      // Rule 2 — Nearly Complete (→ Finish in AppFolio)
      else if (daysSinceUpdate <= 30 && (hasSchedule || hasVendor)) {
        recommendation = 'finish';
        reason = 'Vendor assigned / appointment scheduled — close out in AppFolio';
      }
      // Rule 3 — Active and Unresolved (→ Migrate to Meld)
      else if (daysSinceUpdate <= 90) {
        recommendation = 'migrate';
        reason = 'Active work order — move to Property Meld for tracking';
      }
      // Rule 4 — Fallback (→ Pending / Manual Review)
      else {
        recommendation = 'pending';
        reason = 'Needs manual review';
      }

      summary[recommendation]++;

      return {
        id: wo.id,
        triage_recommendation: recommendation,
        triage_reason: reason,
      };
    });

    // Write recommendations back in batches of 50
    for (let i = 0; i < updates.length; i += 50) {
      const batch = updates.slice(i, i + 50);
      const promises = batch.map((row) =>
        supabase
          .from('work_orders')
          .update({
            triage_recommendation: row.triage_recommendation,
            triage_reason: row.triage_reason,
          })
          .eq('id', row.id)
      );
      await Promise.all(promises);
    }

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Triage score error:', error);
    const message = error instanceof Error ? error.message : 'Scoring failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
