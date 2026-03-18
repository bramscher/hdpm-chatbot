import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/triage/recurring
 *
 * Identify recurring work orders by grouping on (property_name, description)
 * where the same combo appears 2+ times across all work orders (open or closed).
 * Returns grouped results with instance counts and latest status.
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email?.endsWith('@highdesertpm.com')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch all work orders (not just open) to detect recurring patterns
    const { data: allOrders, error } = await supabase
      .from('work_orders')
      .select(
        'id, wo_number, property_name, property_address, unit_name, description, vendor_name, status, appfolio_status, category, scheduled_start, created_at, updated_at'
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching work orders for recurring detection:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const orders = allOrders || [];

    // Group by normalized (property_name + description)
    const groups = new Map<
      string,
      {
        property_name: string;
        property_address: string | null;
        description: string;
        vendor_name: string | null;
        category: string | null;
        instances: Array<{
          id: string;
          wo_number: string | null;
          unit_name: string | null;
          status: string;
          appfolio_status: string | null;
          scheduled_start: string | null;
          created_at: string;
          updated_at: string;
        }>;
      }
    >();

    for (const wo of orders) {
      // Normalize key: lowercase, trim whitespace, collapse spaces
      const normDesc = (wo.description || '').toLowerCase().trim().replace(/\s+/g, ' ');
      const normProp = (wo.property_name || '').toLowerCase().trim().replace(/\s+/g, ' ');
      const key = `${normProp}|||${normDesc}`;

      if (!groups.has(key)) {
        groups.set(key, {
          property_name: wo.property_name,
          property_address: wo.property_address,
          description: wo.description,
          vendor_name: wo.vendor_name,
          category: wo.category,
          instances: [],
        });
      }

      groups.get(key)!.instances.push({
        id: wo.id,
        wo_number: wo.wo_number,
        unit_name: wo.unit_name,
        status: wo.status,
        appfolio_status: wo.appfolio_status,
        scheduled_start: wo.scheduled_start,
        created_at: wo.created_at,
        updated_at: wo.updated_at,
      });
    }

    // Filter to groups with 2+ instances (recurring pattern)
    const recurring = Array.from(groups.values())
      .filter((g) => g.instances.length >= 2)
      .sort((a, b) => b.instances.length - a.instances.length)
      .map((g) => ({
        ...g,
        count: g.instances.length,
        open_count: g.instances.filter((i) => i.status === 'open').length,
        latest_created: g.instances[0]?.created_at || null,
        // Detect approximate frequency
        frequency: detectFrequency(g.instances.map((i) => i.created_at)),
      }));

    return NextResponse.json({
      recurring,
      total_groups: recurring.length,
      total_instances: recurring.reduce((sum, g) => sum + g.count, 0),
    });
  } catch (error) {
    console.error('Recurring detection error:', error);
    const message = error instanceof Error ? error.message : 'Failed to detect recurring';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Detect approximate frequency from a list of creation dates.
 */
function detectFrequency(dates: string[]): string | null {
  if (dates.length < 2) return null;

  const sorted = dates
    .map((d) => new Date(d).getTime())
    .filter((t) => !isNaN(t))
    .sort((a, b) => a - b);

  if (sorted.length < 2) return null;

  // Calculate average gap in days
  let totalGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalGap += sorted[i] - sorted[i - 1];
  }
  const avgGapDays = totalGap / (sorted.length - 1) / (1000 * 60 * 60 * 24);

  if (avgGapDays <= 10) return 'weekly';
  if (avgGapDays <= 45) return 'monthly';
  if (avgGapDays <= 120) return 'quarterly';
  if (avgGapDays <= 200) return 'semi-annual';
  if (avgGapDays <= 400) return 'annual';
  return null;
}
