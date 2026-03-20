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
    const { date_range_start, date_range_end, assigned_to, max_stops_per_route } = body;

    if (!date_range_start || !date_range_end) {
      return NextResponse.json(
        { error: 'date_range_start and date_range_end are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Step 1: Fetch eligible inspections with geocoded properties
    const { data: rawInspections, error: fetchError } = await supabase
      .from('inspections')
      .select('id, property_id, status, due_date, priority, inspection_type, inspection_properties(id, address_1, city, state, zip, latitude, longitude)')
      .in('status', ['imported', 'validated', 'queued'])
      .not('inspection_properties.latitude', 'is', null);

    if (fetchError) {
      console.error('Error fetching inspections for routing:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!rawInspections || rawInspections.length === 0) {
      return NextResponse.json({
        routes: [],
        excluded_count: 0,
        message: 'No eligible inspections found with geocoded properties',
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

    // Step 3: Build route plans using the engine
    const result = buildRoutePlans(geoInspections, {
      date_range_start,
      date_range_end,
      assigned_to,
      max_stops_per_route,
    });

    // Step 4: Persist proposed routes to the database
    const createdRoutes = [];
    const scheduledInspectionIds: string[] = [];

    for (const proposed of result.routes) {
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
