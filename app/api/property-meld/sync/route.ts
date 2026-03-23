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
import { fetchAppFolioUnits, fetchAppFolioTenants, type AppFolioUnit, type AppFolioTenant } from '@/lib/appfolio';

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

/**
 * Properties/names to exclude from inspection sync.
 * Case-insensitive partial match against property name and address.
 * Add entries here to skip HOAs, commercial properties, etc.
 */
const EXCLUSION_LIST = [
  'cedar creek hoa',
  // Add more exclusions as needed:
  // 'some commercial property name',
];

/** Words that indicate a property should be excluded (matched as whole words) */
const EXCLUSION_KEYWORDS = [
  'hoa',
];

function isExcluded(propertyName: string, address: string): boolean {
  const name = (propertyName || '').toLowerCase();
  const addr = (address || '').toLowerCase();
  const combined = `${name} ${addr}`;

  // Check exact phrase matches
  if (EXCLUSION_LIST.some(term => combined.includes(term.toLowerCase()))) {
    return true;
  }

  // Check whole-word keyword matches (avoids false positives like "Shoals")
  if (EXCLUSION_KEYWORDS.some(kw => {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return regex.test(combined);
  })) {
    return true;
  }

  return false;
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

    // Step 1: Pull data from Property Meld + AppFolio units
    const multitenantId = await getMultitenantId();
    const pmProperties = await getProperties(multitenantId);
    const pmUnits = await getUnits(multitenantId);

    // Pull LastInspectedDate from AppFolio units API
    let afUnits: AppFolioUnit[] = [];
    try {
      afUnits = await fetchAppFolioUnits();
      console.log(`[Sync] Fetched ${afUnits.length} units from AppFolio`);
    } catch (err) {
      console.error('[Sync] Failed to fetch AppFolio units:', err);
      stats.errors.push(`AppFolio unit fetch failed: ${err instanceof Error ? err.message : String(err)}`);
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

    // Build a lookup: normalized address → LastInspectedDate from AppFolio units
    // This is the most accurate source for "when was this unit last inspected?"
    const lastInspectionByAddress = new Map<string, string>();
    for (const u of afUnits) {
      if (!u.lastInspectedDate) continue;
      const addr = normalizeAddress(u.address1);
      if (!addr) continue;
      const existing = lastInspectionByAddress.get(addr);
      // Keep the most recent inspection date for this address
      if (!existing || u.lastInspectedDate > existing) {
        lastInspectionByAddress.set(addr, u.lastInspectedDate);
      }
    }
    console.log(`[Sync] Built last-inspection lookup with ${lastInspectionByAddress.size} unique addresses from ${afUnits.length} units`);

    // Fallback: Build a lookup of MoveInOn dates from AppFolio tenants
    // Used when a property has no LastInspectedDate
    const moveInByAddress = new Map<string, string>();
    try {
      const afTenants = await fetchAppFolioTenants();
      for (const t of afTenants) {
        if (t.status !== 'Current' || !t.moveInOn) continue;
        const addr = normalizeAddress(t.address1);
        if (!addr) continue;
        const existing = moveInByAddress.get(addr);
        // Keep the most recent move-in for this address
        if (!existing || t.moveInOn > existing) {
          moveInByAddress.set(addr, t.moveInOn);
        }
      }
      console.log(`[Sync] Built move-in fallback lookup with ${moveInByAddress.size} addresses from ${afTenants.length} tenants`);
    } catch (err) {
      console.error('[Sync] Failed to fetch AppFolio tenants for fallback:', err);
      stats.errors.push(`AppFolio tenant fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }

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
    let excludedCount = 0;
    for (const [propId, prop] of propMap) {
      const propertyName = (prop as Record<string, unknown>).property_name as string || '';
      const propertyAddr = (prop as Record<string, unknown>).line_1 as string || '';

      // Skip excluded properties (HOAs, commercial, etc.)
      if (isExcluded(propertyName, propertyAddr)) {
        excludedCount++;
        continue;
      }

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

        // Look up last inspection date from AppFolio units
        // Fallback to move-in date from AppFolio tenants if no inspection date
        const pmAddr = normalizeAddress(address1);
        const lastInspectedStr = lastInspectionByAddress.get(pmAddr) || null;
        const moveInStr = moveInByAddress.get(pmAddr) || null;
        // Use last inspection date if available, otherwise move-in date as proxy
        const effectiveDateStr = lastInspectedStr || moveInStr;
        const dateSource = lastInspectedStr ? 'inspection' : (moveInStr ? 'move_in' : null);

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
          last_inspection_date: lastInspectedStr,
          move_in_date: moveInStr,
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
          // Rule: if a calculated due date is in the past, clamp it to today
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const dueDates: Date[] = [];

          if (effectiveDateStr) {
            const baseDate = new Date(effectiveDateStr + 'T12:00:00');
            // First due date = base + 6 months
            const due1 = new Date(baseDate);
            due1.setMonth(due1.getMonth() + 6);
            dueDates.push(due1 < today ? new Date(today) : due1);
            // Second due date = base + 12 months
            const due2 = new Date(baseDate);
            due2.setMonth(due2.getMonth() + 12);
            dueDates.push(due2 < today ? new Date(today) : due2);
          } else {
            // No date found at all → due today, then again in 6 months
            dueDates.push(new Date(today));
            const sixOut = new Date(today);
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

    return NextResponse.json({ stats, excluded_count: excludedCount });
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
