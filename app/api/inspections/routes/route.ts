import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildRoutePlans } from '@/lib/route-engine';
import type { GeoInspection, RouteGenerationRequest } from '@/types/routes';

// ============================================
// GET /api/inspections/routes
// List route plans with optional filters
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email?.endsWith('@highdesertpm.com')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const assignedTo = searchParams.get('assigned_to');
    const status = searchParams.get('status');

    let query = supabase
      .from('route_plans')
      .select('*', { count: 'exact' });

    if (dateFrom) {
      query = query.gte('route_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('route_date', dateTo);
    }

    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('route_date', { ascending: true });

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching route plans:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      routes: data || [],
      total: count ?? 0,
    });
  } catch (error) {
    console.error('Route plans GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch route plans';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ============================================
// POST /api/inspections/routes
// Generate route plans from pending inspections
// ============================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email?.endsWith('@highdesertpm.com')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: RouteGenerationRequest = await request.json();
    const { date_range_start, date_range_end, assigned_to, max_stops_per_route, inspection_ids } = body;

    if (!date_range_start || !date_range_end) {
      return NextResponse.json(
        { error: 'date_range_start and date_range_end are required' },
        { status: 400 }
      );
    }

    // Enforce 7-day minimum lead time for tenant notification
    const minRouteDate = new Date();
    minRouteDate.setDate(minRouteDate.getDate() + 7);
    const minDateStr = minRouteDate.toISOString().split('T')[0];

    if (date_range_start < minDateStr) {
      return NextResponse.json(
        { error: 'Routes must be scheduled at least 7 days in advance to allow time for tenant notices.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Step 1: Fetch inspections — either manually picked or auto-selected
    let query = supabase
      .from('inspections')
      .select('id, property_id, status, due_date, priority, inspection_type, inspection_properties(id, address_1, city, state, zip, latitude, longitude)');

    if (inspection_ids && inspection_ids.length > 0) {
      // Manual pick mode — fetch specific inspections by ID
      query = query.in('id', inspection_ids);
    } else {
      // Auto mode — fetch inspections within the scheduling window
      // Window: 1 week BEFORE due date to 4 weeks AFTER due date
      // relative to the route date (date_range_start)
      const routeDate = new Date(date_range_start + 'T12:00:00');

      // An inspection is eligible if:
      //   route_date >= due_date - 28 days (we can do it up to 4 weeks early... wait, reversed)
      //   Actually: due_date - 7 days <= route_date <= due_date + 28 days
      //   Which means: due_date >= route_date - 28 days AND due_date <= route_date + 7 days
      const windowStart = new Date(routeDate);
      windowStart.setDate(windowStart.getDate() - 28); // inspections due up to 4 weeks ago (overdue)
      const windowEnd = new Date(routeDate);
      windowEnd.setDate(windowEnd.getDate() + 7); // inspections due up to 1 week from now (early)

      query = query
        .in('status', ['imported', 'validated', 'queued'])
        .not('inspection_properties.latitude', 'is', null)
        .gte('due_date', windowStart.toISOString().split('T')[0])
        .lte('due_date', windowEnd.toISOString().split('T')[0]);
    }

    const { data: rawInspections, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching inspections for routing:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!rawInspections || rawInspections.length === 0) {
      return NextResponse.json({
        routes: [],
        excluded_count: 0,
        message: inspection_ids ? 'None of the selected inspections were found' : 'No eligible inspections found with geocoded properties',
      });
    }

    // Step 2: Map to GeoInspection objects
    const today = new Date();
    const geoInspections: GeoInspection[] = [];

    for (const insp of rawInspections) {
      const prop = insp.inspection_properties as unknown as {
        id: string;
        address_1: string;
        city: string;
        state: string;
        zip: string;
        latitude: number | null;
        longitude: number | null;
      };

      // Skip inspections whose property join came back null or missing coords
      if (!prop || prop.latitude == null || prop.longitude == null) {
        continue;
      }

      const dueDate = insp.due_date ? new Date(insp.due_date) : null;
      const daysOverdue = dueDate
        ? Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      geoInspections.push({
        inspection_id: insp.id,
        property_id: insp.property_id,
        address: `${prop.address_1}, ${prop.city}, ${prop.state} ${prop.zip}`,
        city: prop.city || 'Unknown',
        lat: prop.latitude,
        lng: prop.longitude,
        due_date: insp.due_date,
        priority: insp.priority || 'normal',
        service_minutes: 30,
        days_overdue: daysOverdue,
      });
    }

    if (geoInspections.length === 0) {
      return NextResponse.json({
        routes: [],
        excluded_count: rawInspections.length,
        message: 'All inspections were excluded (missing coordinates)',
      });
    }

    // Step 3: Build ONE route per request
    const isManualPick = inspection_ids && inspection_ids.length > 0;
    let selectedInspections: GeoInspection[];

    if (isManualPick) {
      // Manual pick mode — use all fetched inspections as-is (user chose them)
      selectedInspections = geoInspections;
    } else {
      // Auto mode — group by city and pick top N
      const maxStops = max_stops_per_route || 10;

      const cityGroups = new Map<string, GeoInspection[]>();
      for (const insp of geoInspections) {
        const city = (insp.city || 'Unknown').trim();
        if (!cityGroups.has(city)) cityGroups.set(city, []);
        cityGroups.get(city)!.push(insp);
      }

      for (const [, group] of cityGroups) {
        group.sort((a, b) => {
          if (b.days_overdue !== a.days_overdue) return b.days_overdue - a.days_overdue;
          const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          return aDate - bDate;
        });
      }

      const cityEntries = [...cityGroups.entries()].sort((a, b) => {
        const aOverdue = a[1].reduce((sum, i) => sum + i.days_overdue, 0);
        const bOverdue = b[1].reduce((sum, i) => sum + i.days_overdue, 0);
        if (b[1].length !== a[1].length) return b[1].length - a[1].length;
        return bOverdue - aOverdue;
      });

      const [topCity, topGroup] = cityEntries[0];

      // Group ALL inspections (across cities) by street/neighborhood for proximity clustering
      // Extract street name from address (e.g., "1534 SW 36th Lp" → "SW 36th Lp")
      const getStreetKey = (address: string, city: string): string => {
        const stripped = address.replace(/^\d+[-\s]?\d*\s*/, '').trim(); // Remove house number
        return `${stripped}|${city}`.toLowerCase();
      };

      // Gather all eligible inspections across cities
      const allEligible: GeoInspection[] = [];
      for (const [, group] of cityEntries) {
        allEligible.push(...group);
      }

      // Group by street
      const streetGroups = new Map<string, GeoInspection[]>();
      for (const insp of allEligible) {
        const streetKey = getStreetKey(insp.address.split(',')[0] || '', insp.city);
        if (!streetGroups.has(streetKey)) streetGroups.set(streetKey, []);
        streetGroups.get(streetKey)!.push(insp);
      }

      // Sort street groups by size (largest clusters first = most efficient routes)
      // Then by total overdue days as tiebreaker
      const sortedStreetGroups = [...streetGroups.entries()].sort((a, b) => {
        if (b[1].length !== a[1].length) return b[1].length - a[1].length;
        const aOverdue = a[1].reduce((s, i) => s + i.days_overdue, 0);
        const bOverdue = b[1].reduce((s, i) => s + i.days_overdue, 0);
        return bOverdue - aOverdue;
      });

      // Now also group by physical address (lat/lng) for multi-unit dedup
      const groupByAddress = (inspections: GeoInspection[]): GeoInspection[][] => {
        const addrMap = new Map<string, GeoInspection[]>();
        for (const insp of inspections) {
          const addrKey = `${insp.lat.toFixed(5)},${insp.lng.toFixed(5)}`;
          if (!addrMap.has(addrKey)) addrMap.set(addrKey, []);
          addrMap.get(addrKey)!.push(insp);
        }
        return [...addrMap.values()];
      };

      // Fill the route: start with the largest street cluster, then nearest neighbors
      selectedInspections = [];
      let physicalStops = 0;
      const usedInspectionIds = new Set<string>();

      // First, take as many as we can from the biggest street cluster
      for (const [, streetInspections] of sortedStreetGroups) {
        if (physicalStops >= maxStops) break;

        const addrGroups = groupByAddress(streetInspections);
        for (const addrGroup of addrGroups) {
          if (physicalStops >= maxStops) break;
          const unused = addrGroup.filter(i => !usedInspectionIds.has(i.inspection_id));
          if (unused.length === 0) continue;

          selectedInspections.push(...unused);
          unused.forEach(i => usedInspectionIds.add(i.inspection_id));
          physicalStops++;
        }
      }

      // If we still need more, backfill with nearest unrouted inspections
      if (physicalStops < maxStops) {
        const centroidLat = selectedInspections.length > 0
          ? selectedInspections.reduce((s, i) => s + i.lat, 0) / selectedInspections.length
          : (allEligible[0]?.lat || 44.256798);
        const centroidLng = selectedInspections.length > 0
          ? selectedInspections.reduce((s, i) => s + i.lng, 0) / selectedInspections.length
          : (allEligible[0]?.lng || -121.184346);

        const remaining = allEligible.filter(i => !usedInspectionIds.has(i.inspection_id));
        const remAddrGroups = groupByAddress(remaining);

        // Sort remaining address groups by distance from current route centroid
        remAddrGroups.sort((a, b) => {
          const aLat = a[0].lat, aLng = a[0].lng;
          const bLat = b[0].lat, bLng = b[0].lng;
          return Math.hypot(aLat - centroidLat, aLng - centroidLng) -
                 Math.hypot(bLat - centroidLat, bLng - centroidLng);
        });

        for (const addrGroup of remAddrGroups) {
          if (physicalStops >= maxStops) break;
          selectedInspections.push(...addrGroup);
          addrGroup.forEach(i => usedInspectionIds.add(i.inspection_id));
          physicalStops++;
        }
      }
    }

    const maxStops = isManualPick ? selectedInspections.length : (max_stops_per_route || 10);

    const result = buildRoutePlans(selectedInspections, {
      date_range_start,
      date_range_end,
      assigned_to,
      max_stops_per_route: maxStops,
    });

    // Step 4: Persist proposed routes to the database
    // Only create ONE route per request (take the first/largest)
    const createdRoutes = [];
    const scheduledInspectionIds: string[] = [];
    const routesToCreate = result.routes.slice(0, 1);

    for (const proposed of routesToCreate) {
      // Insert route plan
      const { data: routePlan, error: planError } = await supabase
        .from('route_plans')
        .insert({
          route_date: proposed.route_date,
          assigned_to: proposed.assigned_to || session.user?.email || 'unassigned',
          status: 'draft',
          total_drive_minutes: Math.round(proposed.total_drive_minutes || 0),
          total_service_minutes: Math.round(proposed.total_service_minutes || 0),
          total_stops: Math.round(proposed.stop_count || 0),
          notes: proposed.name,
        })
        .select()
        .single();

      if (planError) {
        console.error('Error inserting route plan:', planError);
        return NextResponse.json({ error: `Failed to save route plan: ${planError.message}` }, { status: 500 });
      }

      // Insert route stops
      const stopsToInsert = proposed.stops.map((stop) => ({
        route_plan_id: routePlan.id,
        inspection_id: stop.inspection_id,
        stop_order: stop.stop_order,
        travel_minutes_from_previous: Math.round(stop.drive_minutes_from_prev || 0),
        service_minutes: Math.round(stop.service_minutes || 30),
      }));

      const { error: stopsError } = await supabase
        .from('route_stops')
        .insert(stopsToInsert);

      if (stopsError) {
        console.error('Error inserting route stops:', stopsError);
        return NextResponse.json({ error: `Failed to save route stops: ${stopsError.message}` }, { status: 500 });
      }

      // Collect inspection IDs for status update
      for (const stop of proposed.stops) {
        scheduledInspectionIds.push(stop.inspection_id);
      }

      createdRoutes.push(routePlan);
    }

    // Step 5: Update included inspections to 'scheduled'
    if (scheduledInspectionIds.length > 0) {
      const { error: updateError } = await supabase
        .from('inspections')
        .update({ status: 'scheduled', updated_at: new Date().toISOString() })
        .in('id', scheduledInspectionIds);

      if (updateError) {
        console.error('Error updating inspection statuses:', updateError);
        // Non-fatal: routes were created, but status update failed
      }
    }

    // Step 6: Return results
    return NextResponse.json({
      routes: createdRoutes,
      excluded_count: result.excluded.length,
      excluded: result.excluded,
      scheduled_count: scheduledInspectionIds.length,
    });
  } catch (error) {
    console.error('Route generation POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate routes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
