import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { triageWorkOrderBatch, chunkArray, TriageInput } from '@/lib/triage-ai';

const BATCH_SIZE = 15;

/**
 * POST /api/triage/ai-review
 *
 * Sends all unactioned open work orders through Claude Haiku for
 * AI-powered classification. Streams progress via SSE.
 */
export async function POST() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email?.endsWith('@highdesertpm.com')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    // Fetch all open, unactioned work orders with full detail
    const { data: workOrders, error: fetchError } = await supabase
      .from('work_orders')
      .select(
        'id, wo_number, property_name, unit_name, description, category, priority, appfolio_status, vendor_name, assigned_to, scheduled_start, created_at, updated_at'
      )
      .eq('status', 'open')
      .is('triage_action_taken', null)
      .order('created_at', { ascending: false });

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const orders: TriageInput[] = workOrders || [];
    const batches = chunkArray(orders, BATCH_SIZE);
    const totalBatches = batches.length;

    const summary = { close: 0, finish: 0, migrate: 0 };

    // SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        // Send initial count
        send({ type: 'start', total: orders.length, batches: totalBatches });

        for (let i = 0; i < batches.length; i++) {
          try {
            const results = await triageWorkOrderBatch(batches[i]);

            // Write results to DB
            const promises = results
              .filter((r) => r.id) // skip any that didn't match
              .map((r) => {
                summary[r.recommendation]++;
                return supabase
                  .from('work_orders')
                  .update({
                    triage_recommendation: r.recommendation,
                    triage_reason: r.reason,
                    triage_scored_by: 'ai',
                  })
                  .eq('id', r.id);
              });

            await Promise.all(promises);

            send({
              type: 'progress',
              batch: i + 1,
              completed: Math.min((i + 1) * BATCH_SIZE, orders.length),
              total: orders.length,
            });
          } catch (err) {
            console.error(`[AI Review] Batch ${i + 1} error:`, err);
            send({
              type: 'error',
              batch: i + 1,
              message: err instanceof Error ? err.message : 'Batch failed',
            });
            // Continue with next batch
          }
        }

        send({ type: 'complete', summary });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI Review error:', error);
    const message = error instanceof Error ? error.message : 'AI review failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
