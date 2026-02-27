import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { fetchAppFolioWorkOrders, fetchAllPropertiesPublic } from '@/lib/appfolio';
import { bulkUpsertWorkOrders } from '@/lib/work-orders';

/**
 * GET /api/sync/work-orders
 *
 * Debug endpoint — test AppFolio work order API connectivity.
 * TEMPORARILY PUBLIC for diagnostics. TODO: add auth back once API is working.
 */
export async function GET() {
  try {
    console.log('[Sync] GET — testing AppFolio work orders API...');

    const workOrders = await fetchAppFolioWorkOrders();

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
 * Auth: CRON_SECRET (for nightly cron) OR session auth (for manual "Sync Now" button).
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

    console.log(`[Sync] Starting work orders sync (${isCron ? 'cron' : 'manual'})...`);

    // Step 1: Fetch all work orders from AppFolio
    const workOrders = await fetchAppFolioWorkOrders();
    if (workOrders.length === 0) {
      return NextResponse.json({
        message: 'No work orders found (API not configured or no work orders)',
        synced: 0,
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
    });
  } catch (error) {
    console.error('[Sync] Work orders sync error:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
