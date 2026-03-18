import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/triage/action
 *
 * Bulk-apply a triage action to an array of work order IDs.
 */

interface ActionBody {
  workOrderIds: string[];
  action: 'closed' | 'kept' | 'migrated';
  wasOverridden: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email?.endsWith('@highdesertpm.com')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as ActionBody;

    if (!body.workOrderIds?.length) {
      return NextResponse.json({ error: 'workOrderIds is required' }, { status: 400 });
    }

    if (!['closed', 'kept', 'migrated'].includes(body.action)) {
      return NextResponse.json({ error: 'action must be closed, kept, or migrated' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    let updated = 0;

    // Process in batches of 50
    for (let i = 0; i < body.workOrderIds.length; i += 50) {
      const batch = body.workOrderIds.slice(i, i + 50);
      const promises = batch.map(async (id) => {
        // Only set triage_reviewed_at if it hasn't been set before
        const { data: existing } = await supabase
          .from('work_orders')
          .select('triage_reviewed_at')
          .eq('id', id)
          .single();

        const updateData: Record<string, unknown> = {
          triage_action_taken: body.action,
          triage_was_overridden: body.wasOverridden,
        };

        // Preserve original action timestamp
        if (!existing?.triage_reviewed_at) {
          updateData.triage_reviewed_at = now;
        }

        const { error } = await supabase
          .from('work_orders')
          .update(updateData)
          .eq('id', id);

        if (!error) updated++;
      });

      await Promise.all(promises);
    }

    return NextResponse.json({ updated });
  } catch (error) {
    console.error('Triage action error:', error);
    const message = error instanceof Error ? error.message : 'Action failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
