import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { fetchAppFolioWorkOrders, fetchAllPropertiesPublic, fetchAllVendors } from '@/lib/appfolio';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/triage/sync
 *
 * Sync ONLY open work orders from AppFolio.
 * Fetches last 120 days, filters to open status, then upserts only those.
 * 120 days covers the 90-day triage window plus a buffer for stragglers.
 */
export const maxDuration = 300;

export async function POST() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email?.endsWith('@highdesertpm.com')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Triage Sync] Starting open work orders sync (120 days)...');

    // Fetch vendors for name resolution
    const vendorMap = await fetchAllVendors();

    // Fetch work orders from last 120 days
    const allOrders = await fetchAppFolioWorkOrders(120, vendorMap);

    // Filter to only open work orders
    const openOrders = allOrders.filter((wo) => wo.status === 'open');
    console.log(`[Triage Sync] ${allOrders.length} total fetched, ${openOrders.length} are open`);

    if (openOrders.length === 0) {
      return NextResponse.json({ message: 'No open work orders found', synced: 0 });
    }

    // Build property map
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

    // Upsert open work orders only
    const supabase = getSupabaseAdmin();
    const rows = openOrders.map((wo) => {
      const prop = wo.propertyId ? propertyMap.get(wo.propertyId) : null;
      return {
        appfolio_id: wo.appfolioId,
        property_id: wo.propertyId,
        property_name: prop?.name || 'Unknown Property',
        property_address: prop?.address || null,
        unit_id: wo.unitId,
        wo_number: wo.woNumber,
        description: wo.description || 'No description',
        status: wo.status,
        appfolio_status: wo.appfolioStatus,
        priority: wo.priority,
        assigned_to: wo.assignedTo,
        vendor_id: wo.vendorId,
        vendor_name: wo.vendorName,
        scheduled_start: wo.scheduledStart,
        scheduled_end: wo.scheduledEnd,
        completed_date: wo.completedDate,
        canceled_date: wo.canceledDate,
        permission_to_enter: wo.permissionToEnter,
        synced_at: new Date().toISOString(),
      };
    });

    // Upsert in batches of 500
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const appfolioIds = batch.map((r) => r.appfolio_id);

      // Delete existing rows for these IDs
      await supabase.from('work_orders').delete().in('appfolio_id', appfolioIds);

      // Insert fresh
      const { error } = await supabase.from('work_orders').insert(batch);
      if (error) {
        console.error('[Triage Sync] Insert error:', error);
        throw new Error(error.message);
      }
      upserted += batch.length;
    }

    console.log(`[Triage Sync] Complete: ${upserted} open work orders synced`);

    return NextResponse.json({
      message: 'Open work orders synced',
      total_fetched: allOrders.length,
      open_synced: upserted,
    });
  } catch (error) {
    console.error('[Triage Sync] Error:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
