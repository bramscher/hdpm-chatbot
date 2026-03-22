/**
 * Property Meld → Inspection Sync
 *
 * POST /api/property-meld/sync
 *
 * Pulls all properties & units from Property Meld and syncs them
 * into the inspection_properties and inspections tables.
 *
 * - New properties get created
 * - Existing properties get updated (matched by PM property_id + unit_id)
 * - Inspections are created for properties that don't have one yet
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import {
  getAccessToken,
  getMultitenantId,
  getProperties,
  getUnits,
  type PMProperty,
  type PMUnit,
} from '@/lib/property-meld';
import { fetchAppFolioTenants, type AppFolioTenant } from '@/lib/appfolio';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Normalize an address for matching between PM and AppFolio */
function normalizeAddress(addr: string | null | undefined): string {
  return (addr || '')
    .toLowerCase()
    .trim()
    .replace(/[.,#]/g, '')
    .replace(/\s+/g, ' ')
    // Strip unit/apt suffixes from addresses like "438 NW 19th St #23"
    .replace(/\s+(unit|apt|suite|ste|#)\s*\S*$/i, '')
    .replace(/\b(street|st)\b/g, 'st')
    .replace(/\b(avenue|ave)\b/g, 'ave')
    .replace(/\b(drive|dr)\b/g, 'dr')
    .replace(/\b(road|rd)\b/g, 'rd')
    .replace(/\b(lane|ln)\b/g, 'ln')
    .replace(/\b(boulevard|blvd)\b/g, 'blvd')
    .replace(/\b(circle|cir)\b/g, 'cir')
    .replace(/\b(court|ct)\b/g, 'ct')
    .replace(/\b(place|pl)\b/g, 'pl')
    .replace(/\b(loop|lp)\b/g, 'lp')
    .replace(/\b(southwest|sw)\b/g, 'sw')
    .replace(/\b(southeast|se)\b/g, 'se')
    .replace(/\b(northwest|nw)\b/g, 'nw')
    .replace(/\b(northeast|ne)\b/g, 'ne');
}

interface SyncStats {
  properties_fetched: number;
  units_fetched: number;
  properties_created: number;
  properties_updated: number;
  inspections_created: number;
  errors: string[];
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    const stats: SyncStats = {
      properties_fetched: 0,
      units_fetched: 0,
      properties_created: 0,
      properties_updated: 0,
      inspections_created: 0,
      errors: [],
    };

    // Step 1: Pull data from Property Meld + AppFolio tenants
    const multitenantId = await getMultitenantId();
    const pmProperties = await getProperties(multitenantId);
    const pmUnits = await getUnits(multitenantId);

    // Pull tenant move-in dates from AppFolio v0 API
    let afTenants: AppFolioTenant[] = [];
    try {
      afTenants = await fetchAppFolioTenants();
      console.log(`[Sync] Fetched ${afTenants.length} tenants from AppFolio`);
    } catch (err) {
      console.error('[Sync] Failed to fetch AppFolio tenants:', err);
      stats.errors.push(`AppFolio tenant fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    stats.properties_fetched = pmProperties.length;
    stats.units_fetched = pmUnits.length;

    // Build a lookup: PM property ID → PM property object
    const propMap = new Map<number, PMProperty>();
    for (const p of pmProperties) {
      propMap.set(p.id, p);
    }

    // Build a lookup: PM property ID → list of PM units
    const unitsByProperty = new Map<number, PMUnit[]>();
    for (const u of pmUnits) {
      const propId = u.property_id || u.property;
      if (!propId) continue;
      if (!unitsByProperty.has(propId)) unitsByProperty.set(propId, []);
      unitsByProperty.get(propId)!.push(u);
    }

    // Build a lookup: AppFolio normalized address → MoveInOn date
    // We match by street address since PM and AppFolio use different IDs
    // For multi-unit properties, we keep the most recent move-in for each address
    const moveInByAddress = new Map<string, string>();
    for (const t of afTenants) {
      if (t.status !== 'Current' || !t.moveInOn) continue;
      const addr = normalizeAddress(t.address1);
      if (!addr) continue;
      const existing = moveInByAddress.get(addr);
      // Keep the most recent move-in date for this address
      if (!existing || t.moveInOn > existing) {
        moveInByAddress.set(addr, t.moveInOn);
      }
    }
    console.log(`[Sync] Built move-in lookup with ${moveInByAddress.size} unique addresses from ${afTenants.length} tenants`);

    // Step 2: Get existing inspection_properties from Supabase for matching
    const { data: existingProps } = await supabase
      .from('inspection_properties')
      .select('id, pm_property_id, pm_unit_id, address_1, address_2');

    const existingMap = new Map<string, { id: string; address_1: string; address_2: string | null }>();
    for (const ep of existingProps || []) {
      if (ep.pm_property_id) {
        const key = `${ep.pm_property_id}-${ep.pm_unit_id || ''}`;
        existingMap.set(key, { id: ep.id, address_1: ep.address_1, address_2: ep.address_2 });
      }
    }

    if (dryRun) {
      // Count what would happen
      for (const [propId, prop] of propMap) {
        const units = unitsByProperty.get(propId) || [];
        if (units.length === 0) {
          // Property with no units — treat as SFR
          const key = `${propId}-`;
          if (!existingMap.has(key)) stats.properties_created++;
          else stats.properties_updated++;
        } else {
          for (const unit of units) {
            const key = `${propId}-${unit.id}`;
            if (!existingMap.has(key)) stats.properties_created++;
            else stats.properties_updated++;
          }
        }
      }
      stats.inspections_created = stats.properties_created; // 1 inspection per new property
      return NextResponse.json({ dry_run: true, stats });
    }

    // Step 3: Upsert properties and create inspections
    for (const [propId, prop] of propMap) {
      const units = unitsByProperty.get(propId) || [];

      // If no units, treat the property as a single-family residence
      const entries = units.length === 0
        ? [{ unitId: null, unitName: null, unitAddress: null }]
        : units.map(u => ({
            unitId: u.id,
            unitName: u.unit || null,
            unitAddress: u.unit_address || null,
          }));

      for (const entry of entries) {
        const key = `${propId}-${entry.unitId || ''}`;
        const address1 = (prop as Record<string, unknown>).line_1 as string || '';
        const address2 = entry.unitName || (prop as Record<string, unknown>).line_2 as string || null;
        const city = prop.city || '';
        const state = (prop as Record<string, unknown>).county_province as string || '';
        const zip = (prop as Record<string, unknown>).postcode as string || '';
        const propertyName = (prop as Record<string, unknown>).property_name as string || '';

        // Look up move-in date for this address
        const pmAddr = normalizeAddress(address1);
        const moveInDateStr = moveInByAddress.get(pmAddr) || null;

        const propertyData: Record<string, unknown> = {
          address_1: address1,
          address_2: address2,
          city: city,
          state: state,
          zip: zip,
          name: propertyName,
          pm_property_id: propId,
          pm_unit_id: entry.unitId,
          source: 'property_meld',
          active: prop.is_active !== false,
          move_in_date: moveInDateStr,
        };

        const existing = existingMap.get(key);

        if (existing) {
          // Update existing property
          const { error } = await supabase
            .from('inspection_properties')
            .update(propertyData)
            .eq('id', existing.id);

          if (error) {
            stats.errors.push(`Update property ${propId}/${entry.unitId}: ${error.message}`);
          } else {
            stats.properties_updated++;
          }
        } else {
          // Create new property
          const { data: newProp, error: propError } = await supabase
            .from('inspection_properties')
            .insert(propertyData)
            .select('id')
            .single();

          if (propError) {
            stats.errors.push(`Create property ${propId}/${entry.unitId}: ${propError.message}`);
            continue;
          }

          stats.properties_created++;

          // Create TWO inspections per property (next 12 months)
          // Logic: inspections every 6 months from move-in date
          // If no tenant found → due today + 6 months
          const now = new Date();
          const twelveMonthsOut = new Date(now);
          twelveMonthsOut.setMonth(twelveMonthsOut.getMonth() + 12);

          // Find all upcoming 6-month cycles within 12 months
          const dueDates: Date[] = [];

          if (moveInDateStr) {
            const moveIn = new Date(moveInDateStr + 'T12:00:00');
            const candidate = new Date(moveIn);
            // Roll forward in 6-month increments
            while (candidate <= twelveMonthsOut) {
              if (candidate > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) {
                // Include if within last 30 days (slightly overdue) or future
                dueDates.push(new Date(candidate));
              }
              candidate.setMonth(candidate.getMonth() + 6);
            }
          }

          // If no dates found (vacant or no match), default to today + 6 months
          if (dueDates.length === 0) {
            dueDates.push(new Date(now));
            const sixOut = new Date(now);
            sixOut.setMonth(sixOut.getMonth() + 6);
            dueDates.push(sixOut);
          }

          // Cap at 2 inspections per property
          const inspectionsToCreate = dueDates.slice(0, 2);

          for (const dueDate of inspectionsToCreate) {
            const { error: inspError } = await supabase
              .from('inspections')
              .insert({
                property_id: newProp.id,
                inspection_type: 'biannual',
                status: 'imported',
                due_date: dueDate.toISOString().split('T')[0],
              });

            if (inspError) {
              stats.errors.push(`Create inspection for ${propId}/${entry.unitId}: ${inspError.message}`);
            } else {
              stats.inspections_created++;
            }
          }
        }
      }
    }

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Property Meld sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/property-meld/sync
 *
 * Returns sync status / preview (dry run).
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const multitenantId = await getMultitenantId();
    const pmProperties = await getProperties(multitenantId);
    const pmUnits = await getUnits(multitenantId);

    // Get existing counts from Supabase
    const { count: existingCount } = await supabase
      .from('inspection_properties')
      .select('id', { count: 'exact', head: true });

    const { count: inspectionCount } = await supabase
      .from('inspections')
      .select('id', { count: 'exact', head: true });

    // Unique cities in PM data
    const cities = [...new Set(pmProperties.map(p => p.city).filter(Boolean))];

    return NextResponse.json({
      property_meld: {
        properties: pmProperties.length,
        units: pmUnits.length,
        cities,
      },
      supabase: {
        inspection_properties: existingCount,
        inspections: inspectionCount,
      },
      multitenant_id: multitenantId,
    });
  } catch (error) {
    console.error('Property Meld sync status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
