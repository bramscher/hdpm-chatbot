/**
 * Property Meld API Explorer
 *
 * GET /api/property-meld/explore
 *
 * Connects to Property Meld, retrieves the multitenant ID,
 * then pulls properties, units, and meld counts.
 * Used for initial integration testing.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  getAccessToken,
  getManagement,
  getMultitenantId,
  getProperties,
  getUnits,
  getMelds,
  getResidents,
  getVendors,
} from '@/lib/property-meld';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: Record<string, unknown> = {};

    // Step 1: Get OAuth token
    const token = await getAccessToken();
    results.auth = { status: 'ok', token_preview: token.slice(0, 12) + '...' };

    // Step 2: Get management companies (for multitenant_id)
    const management = await getManagement();
    results.management = management;

    // Step 3: Get multitenant ID
    const multitenantId = await getMultitenantId();
    results.multitenant_id = multitenantId;

    // Step 4: Pull properties (first page only for exploration)
    const properties = await getProperties(multitenantId);
    results.properties = {
      count: properties.length,
      sample: properties.slice(0, 5),
      all_fields: properties.length > 0 ? Object.keys(properties[0]) : [],
    };

    // Step 5: Pull units (first page only)
    const units = await getUnits(multitenantId);
    results.units = {
      count: units.length,
      sample: units.slice(0, 5),
      all_fields: units.length > 0 ? Object.keys(units[0]) : [],
    };

    // Step 6: Pull melds (work orders)
    const melds = await getMelds(multitenantId);
    results.melds = {
      count: melds.length,
      sample: melds.slice(0, 3),
      all_fields: melds.length > 0 ? Object.keys(melds[0]) : [],
      statuses: [...new Set(melds.map(m => m.status))],
    };

    // Step 7: Pull residents
    const residents = await getResidents(multitenantId);
    results.residents = {
      count: residents.length,
      sample: residents.slice(0, 3),
      all_fields: residents.length > 0 ? Object.keys(residents[0]) : [],
    };

    // Step 8: Pull vendors
    const vendors = await getVendors(multitenantId);
    results.vendors = {
      count: vendors.length,
      sample: vendors.slice(0, 3),
      all_fields: vendors.length > 0 ? Object.keys(vendors[0]) : [],
    };

    return NextResponse.json(results);
  } catch (error) {
    console.error('Property Meld explore error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Check PROPERTY_MELD_CLIENT_ID and PROPERTY_MELD_CLIENT_SECRET in .env.local',
      },
      { status: 500 }
    );
  }
}
