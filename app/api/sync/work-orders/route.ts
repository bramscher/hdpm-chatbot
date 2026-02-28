import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { fetchAppFolioWorkOrders, fetchAllPropertiesPublic } from '@/lib/appfolio';
import { bulkUpsertWorkOrders } from '@/lib/work-orders';

// Allow up to 60 seconds for the sync function (Vercel Pro)
export const maxDuration = 60;

/**
 * GET /api/sync/work-orders
 *
 * Health check — test AppFolio work order API connectivity.
 */
export async function GET() {
  try {
    console.log('[Sync] GET — testing AppFolio work orders API...');

    // Only fetch last 7 days for the test endpoint (fast)
    const workOrders = await fetchAppFolioWorkOrders(7);

    return NextResponse.json({
      message: 'AppFolio work orders API test',
      count: workOrders.length,
      sample: workOrders.slice(0, 3),
    });
  } catch (error) {
    console.error('[Sync] GET work orders test error:', error);
    const message = error instanceof Error ? error.message : 'API test failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/sync/work-orders
 *
 * Sync work orders from AppFolio.
 * Auth: CRON_SECRET (for daily cron) OR session auth (for manual "Sync Now" button).
 *
 * Now that webhooks handle real-time updates, this sync is a safety-net catchup:
 *   - Cron (daily at 8am): fetches last 7 days to fill any missed webhooks
 *   - Manual "Sync Now": fetches last 90 days for a broader refresh
 *   - Optional: ?days=365 query param to override the window
 */
export async function POST(request: NextRequest) {
  try {
    // Dual auth: cron secret OR session
    const authHeader = request.headers.get('authorization');
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (!isCron) {
      const session = await getServerSession();
      if (!session?.user?.email?.endsWith('@highdesertpm.com')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Determine sync window
    const url = new URL(request.url);
    const daysParam = url.searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : isCron ? 7 : 90;

    console.log(
      `[Sync] Starting work orders sync (${isCron ? 'cron' : 'manual'}, last ${days} days)...`
    );

    // Step 1: Fetch work orders from AppFolio
    const workOrders = await fetchAppFolioWorkOrders(days);
    if (workOrders.length === 0) {
      return NextResponse.json({
        message: `No work orders updated in the last ${days} days`,
        synced: 0,
        days,
      });
    }

    // Step 2: Fetch all properties to build a propertyId → {name, address} map
    const properties = await fetchAllPropertiesPublic();
    const propertyMap = new Map<string, { name: string; address: string }>();
    for (const p of properties) {
      const address = [p.Address1, p.Address2, p.City, p.State, p.Zip]
        .filter(Boolean)
        .join(', ');
      propertyMap.set(p.Id, {
        name: p.Name || p.Address1 || 'Unknown',
        address,
      });
    }

    // Step 3: Bulk upsert into work_orders table
    const count = await bulkUpsertWorkOrders(workOrders, propertyMap);

    console.log(`[Sync] Work orders sync complete: ${count} work orders upserted`);

    return NextResponse.json({
      message: 'Work orders sync complete',
      synced: count,
      total_fetched: workOrders.length,
      properties_mapped: propertyMap.size,
      days,
    });
  } catch (error) {
    console.error('[Sync] Work orders sync error:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
