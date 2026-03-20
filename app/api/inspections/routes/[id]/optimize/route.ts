import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { optimizeRouteWithGoogle } from '@/lib/route-directions';
import type { ProposedStop } from '@/types/routes';

// ============================================
// POST /api/inspections/routes/[id]/optimize
// Re-optimize an existing route using Google Directions API
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email?.endsWith('@highdesertpm.com')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Step 1: Fetch route plan
    const { data: routePlan, error: planError } = await supabase
      .from('route_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (planError) {
      if (planError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Route plan not found' }, { status: 404 });
      }
      console.error('Error fetching route plan:', planError);
      return NextResponse.json({ error: planError.message }, { status: 500 });
    }

    // Fetch stops with inspection + property coordinates
    const { data: stops, error: stopsError } = await supabase
      .from('route_stops')
      .select(`
        *,
        inspections (
          id,
          inspection_type,
          status,
          due_date,
          priority,
          notes,
          unit_name,
          resident_name,
          property_id,
          inspection_properties (
            id,
            address_1,
            city,
            state,
            zip,
            latitude,
            longitude
          )
        )
      `)
      .eq('route_plan_id', id)
      .order('stop_order', { ascending: true });

    if (stopsError) {
      console.error('Error fetching route stops:', stopsError);
      return NextResponse.json({ error: stopsError.message }, { status: 500 });
    }

    if (!stops || stops.length === 0) {
      return NextResponse.json({ error: 'Route has no stops to optimize' }, { status: 400 });
    }

    // Step 2: Map stops to ProposedStop format for the optimizer
    const proposedStops: ProposedStop[] = stops.map((stop) => {
      const insp = stop.inspections as Record<string, unknown> | null;
      const prop = (insp?.inspection_properties || {}) as Record<string, unknown>;

      return {
        inspection_id: stop.inspection_id,
        property_id: (insp?.property_id as string) || '',
        stop_order: stop.stop_order,
        drive_minutes_from_prev: stop.travel_minutes_from_previous || 0,
        drive_meters_from_prev: 0,
        service_minutes: stop.service_minutes || 30,
        lat: (prop.latitude as number) ?? 0,
        lng: (prop.longitude as number) ?? 0,
        address: prop.address_1 ? `${prop.address_1}, ${prop.city}, ${prop.state} ${prop.zip}` : '',
        city: (prop.city as string) ?? 'Unknown',
      };
    });

    const startLat = routePlan.start_lat ?? 44.2726;
    const startLng = routePlan.start_lng ?? -121.1739;

    // Step 3: Call Google Directions optimization
    const optimized = await optimizeRouteWithGoogle(proposedStops, startLat, startLng);

    // Step 4: Update each route_stop with new ordering and drive data
    // Also compute scheduled_arrival times starting at 8:00 AM
    const routeDate = routePlan.route_date;
    let cumulativeMinutes = 0; // minutes from 8:00 AM start

    for (const optimizedStop of optimized.stops) {
      // Find the original DB stop by inspection_id
      const originalStop = stops.find((s) => s.inspection_id === optimizedStop.inspection_id);
      if (!originalStop) continue;

      // Cumulative time: drive to this stop
      cumulativeMinutes += optimizedStop.drive_minutes_from_prev;

      // Compute scheduled arrival: route_date at 8:00 AM + cumulative minutes
      const arrivalDate = new Date(`${routeDate}T08:00:00`);
      arrivalDate.setMinutes(arrivalDate.getMinutes() + Math.round(cumulativeMinutes));
      const scheduledArrival = arrivalDate.toISOString();

      const { error: updateError } = await supabase
        .from('route_stops')
        .update({
          stop_order: optimizedStop.stop_order,
          travel_minutes_from_previous: Math.round(optimizedStop.drive_minutes_from_prev || 0),
          estimated_arrival: scheduledArrival,
        })
        .eq('id', originalStop.id);

      if (updateError) {
        console.error('Error updating optimized stop:', updateError);
        return NextResponse.json({ error: `Failed to update stop: ${updateError.message}` }, { status: 500 });
      }

      // Add service time for the next stop's arrival calculation
      cumulativeMinutes += optimizedStop.service_minutes;
    }

    // Step 5: Update route_plan totals and status
    const { error: planUpdateError } = await supabase
      .from('route_plans')
      .update({
        total_drive_minutes: Math.round(optimized.total_drive_minutes || 0),
        status: 'optimized',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (planUpdateError) {
      console.error('Error updating route plan after optimization:', planUpdateError);
      return NextResponse.json({ error: planUpdateError.message }, { status: 500 });
    }

    // Step 6: Return the updated route
    const { data: updatedPlan } = await supabase
      .from('route_plans')
      .select('*')
      .eq('id', id)
      .single();

    const { data: updatedStops } = await supabase
      .from('route_stops')
      .select(`
        *,
        inspections (
          id,
          inspection_type,
          status,
          due_date,
          priority,
          notes,
          unit_name,
          resident_name,
          inspection_properties (
            id,
            address_1,
            city,
            state,
            zip,
            latitude,
            longitude
          )
        )
      `)
      .eq('route_plan_id', id)
      .order('stop_order', { ascending: true });

    return NextResponse.json({
      ...updatedPlan,
      stops: updatedStops || [],
      optimization_source: optimized.source,
      polyline: optimized.polyline,
    });
  } catch (error) {
    console.error('Route optimize POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to optimize route';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
