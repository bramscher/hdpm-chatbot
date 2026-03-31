import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getMultitenantId, createMeld, findWorkCategory } from '@/lib/property-meld';

/**
 * PATCH /api/inspections/routes/[id]/stops
 * Update a stop's status (complete, skip, flag issue)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email?.endsWith('@highdesertpm.com')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: routePlanId } = await params;
    const body = await request.json();
    const { stop_id, action, notes, issues_found, issue_severity } = body;

    if (!stop_id || !action) {
      return NextResponse.json(
        { error: 'stop_id and action are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    // Verify the stop belongs to this route
    const { data: stop, error: stopErr } = await supabase
      .from('route_stops')
      .select('id, inspection_id, status')
      .eq('id', stop_id)
      .eq('route_plan_id', routePlanId)
      .single();

    if (stopErr || !stop) {
      return NextResponse.json({ error: 'Stop not found' }, { status: 404 });
    }

    // ── Start Inspection: create PM meld and set stop in_progress ──
    if (action === 'start') {
      // Get inspection + property details
      const { data: inspection, error: inspErr } = await supabase
        .from('inspections')
        .select(`
          id, inspection_type, unit_name, resident_name, meld_id,
          inspection_properties (
            id, name, address_1, address_2, city, state, zip,
            pm_property_id, pm_unit_id
          )
        `)
        .eq('id', stop.inspection_id)
        .single();

      if (inspErr || !inspection) {
        return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
      }

      // Supabase returns the FK join as a single object (not array) for .single()
      const rawProp = inspection.inspection_properties as unknown;
      const prop = (Array.isArray(rawProp) ? rawProp[0] : rawProp) as Record<string, unknown> | null;
      const pmPropertyId = prop?.pm_property_id as number | null;
      const pmUnitId = prop?.pm_unit_id as number | null;
      const address = [prop?.address_1, prop?.address_2, prop?.city].filter(Boolean).join(', ');

      // Don't create duplicate melds
      if (inspection.meld_id) {
        // Already started — just ensure stop is in_progress
        await supabase
          .from('route_stops')
          .update({ status: 'in_progress', actual_arrival: now })
          .eq('id', stop_id);

        return NextResponse.json({
          success: true,
          stop_status: 'in_progress',
          meld_id: inspection.meld_id,
          already_started: true,
        });
      }

      // Create Property Meld meld
      let meldId: number | null = null;
      let meldError: string | null = null;

      if (pmPropertyId || pmUnitId) {
        try {
          const multitenantId = await getMultitenantId();
          const inspType = inspection.inspection_type || 'biannual';
          const resident = inspection.resident_name ? ` — ${inspection.resident_name}` : '';
          const unit = inspection.unit_name ? ` (Unit ${inspection.unit_name})` : '';

          // Resolve work_category from Property Meld's category list
          const workCategoryId = await findWorkCategory(multitenantId, 'inspection');

          const meld = await createMeld(multitenantId, {
            ...(pmUnitId ? { unit: pmUnitId } : {}),
            ...(pmPropertyId && !pmUnitId ? { property: pmPropertyId } : {}),
            work_location: pmUnitId || pmPropertyId,
            work_type: 'manager_meld',
            ...(workCategoryId ? { work_category: workCategoryId } : {}),
            brief_description: `${inspType.charAt(0).toUpperCase() + inspType.slice(1)} Inspection — ${address}${unit}`,
            description: [
              `Scheduled ${inspType} property inspection.`,
              `Address: ${address}${unit}`,
              resident ? `Resident: ${inspection.resident_name}` : null,
              `Inspector: ${session.user.email}`,
              `Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}`,
            ].filter(Boolean).join('\n'),
            category: 'Inspection',
            priority: 'low',
          });

          meldId = meld.id;
        } catch (err) {
          console.error('Property Meld creation error:', err);
          meldError = err instanceof Error ? err.message : 'Failed to create meld';
        }
      } else {
        meldError = 'Property not linked to Property Meld (no pm_property_id/pm_unit_id)';
      }

      // Update stop to in_progress
      await supabase
        .from('route_stops')
        .update({ status: 'in_progress', actual_arrival: now })
        .eq('id', stop_id);

      // Update inspection with meld_id
      const inspUpdate: Record<string, unknown> = {
        status: 'scheduled',
        updated_at: now,
      };
      if (meldId) {
        inspUpdate.meld_id = String(meldId);
      }

      await supabase
        .from('inspections')
        .update(inspUpdate)
        .eq('id', stop.inspection_id);

      // Update route to in_progress if it's dispatched
      await supabase
        .from('route_plans')
        .update({ status: 'in_progress', updated_at: now })
        .eq('id', routePlanId)
        .in('status', ['dispatched', 'optimized', 'draft']);

      return NextResponse.json({
        success: true,
        stop_status: 'in_progress',
        meld_id: meldId,
        meld_error: meldError,
      });
    }

    let newStopStatus: string;
    let inspectionStatus: string;

    switch (action) {
      case 'complete':
        newStopStatus = 'completed';
        inspectionStatus = 'completed';
        break;
      case 'skip':
        newStopStatus = 'skipped';
        inspectionStatus = 'imported'; // Back to queue
        break;
      case 'flag_issue':
        newStopStatus = 'completed';
        inspectionStatus = 'completed';
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Update route_stop
    const { error: updateStopErr } = await supabase
      .from('route_stops')
      .update({
        status: newStopStatus,
        actual_arrival: now,
        actual_departure: now,
      })
      .eq('id', stop_id);

    if (updateStopErr) {
      console.error('Error updating stop:', updateStopErr);
      return NextResponse.json({ error: updateStopErr.message }, { status: 500 });
    }

    // Update inspection
    const inspectionUpdate: Record<string, unknown> = {
      status: inspectionStatus,
      updated_at: now,
    };

    if (action === 'complete' || action === 'flag_issue') {
      inspectionUpdate.completed_at = now;
      inspectionUpdate.completed_by = session.user.email;
    }

    if (notes) {
      inspectionUpdate.completion_notes = notes;
    }

    if (action === 'flag_issue') {
      inspectionUpdate.issues_found = true;
      inspectionUpdate.issue_severity = issue_severity || 'medium';
    }

    const { error: updateInspErr } = await supabase
      .from('inspections')
      .update(inspectionUpdate)
      .eq('id', stop.inspection_id);

    if (updateInspErr) {
      console.error('Error updating inspection:', updateInspErr);
      return NextResponse.json({ error: updateInspErr.message }, { status: 500 });
    }

    // Check if all stops are done — if so, mark route complete
    const { data: allStops } = await supabase
      .from('route_stops')
      .select('status')
      .eq('route_plan_id', routePlanId);

    const allDone = allStops?.every(
      (s) => s.status === 'completed' || s.status === 'skipped'
    );

    if (allDone) {
      await supabase
        .from('route_plans')
        .update({ status: 'completed', updated_at: now })
        .eq('id', routePlanId);
    }

    // Auto-create next inspection when completed (6 months out)
    let nextInspectionCreated = false;
    if (action === 'complete') {
      // Get the property_id from the inspection
      const { data: completedInsp } = await supabase
        .from('inspections')
        .select('property_id')
        .eq('id', stop.inspection_id)
        .single();

      if (completedInsp) {
        // Check if a future inspection already exists
        const { data: existing } = await supabase
          .from('inspections')
          .select('id')
          .eq('property_id', completedInsp.property_id)
          .neq('status', 'completed')
          .neq('status', 'canceled')
          .limit(1);

        if (!existing || existing.length === 0) {
          const sixMonths = new Date();
          sixMonths.setMonth(sixMonths.getMonth() + 6);
          await supabase.from('inspections').insert({
            property_id: completedInsp.property_id,
            inspection_type: 'biannual',
            status: 'imported',
            due_date: sixMonths.toISOString().split('T')[0],
          });
          nextInspectionCreated = true;
        }
      }
    }

    return NextResponse.json({
      success: true,
      stop_status: newStopStatus,
      inspection_status: inspectionStatus,
      route_completed: allDone || false,
      next_inspection_created: nextInspectionCreated,
    });
  } catch (error) {
    console.error('Stop update error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update stop';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
