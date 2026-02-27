/**
 * AppFolio Database API (v0) Client
 *
 * Fetches property and unit data from AppFolio's v0 Database API,
 * maps to our rental_comps schema for nightly sync.
 *
 * Uses the same credentials and API as the Konmashi integration.
 * API base: https://api.appfolio.com/api/v0
 * Auth: Basic (ClientId:ClientSecret) + X-AppFolio-Developer-ID header
 *
 * Required env vars:
 *   APPFOLIO_CLIENT_ID
 *   APPFOLIO_CLIENT_SECRET
 *   APPFOLIO_DEVELOPER_ID
 */

import type { CreateCompInput, Town, PropertyType } from '@/types/comps';

// ============================================
// Config
// ============================================

const APPFOLIO_V0_BASE = 'https://api.appfolio.com/api/v0';

function getConfig() {
  const clientId = process.env.APPFOLIO_CLIENT_ID;
  const clientSecret = process.env.APPFOLIO_CLIENT_SECRET;
  const developerId = process.env.APPFOLIO_DEVELOPER_ID;

  if (!clientId || !clientSecret || !developerId) {
    console.warn('[AppFolio] Missing API credentials — sync will be skipped');
    console.warn('[AppFolio] Need: APPFOLIO_CLIENT_ID, APPFOLIO_CLIENT_SECRET, APPFOLIO_DEVELOPER_ID');
    return null;
  }

  return { clientId, clientSecret, developerId };
}

// ============================================
// v0 API Client
// ============================================

interface V0ListResponse<T = Record<string, unknown>> {
  data: T[];
  next_page_path?: string | null;
}

async function v0Fetch<T>(
  path: string,
  params: Record<string, string>,
  clientId: string,
  clientSecret: string,
  developerId: string
): Promise<V0ListResponse<T>> {
  const url = new URL(`${APPFOLIO_V0_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
      'X-AppFolio-Developer-ID': developerId,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`AppFolio v0 error (${response.status}): ${text.substring(0, 300)}`);
  }

  try {
    return JSON.parse(text) as V0ListResponse<T>;
  } catch {
    throw new Error(`AppFolio v0 invalid JSON: ${text.substring(0, 200)}`);
  }
}

// ============================================
// v0 API Types
// ============================================

interface V0Property {
  Id: string;
  Name?: string;
  Address1?: string;
  Address2?: string;
  City?: string;
  State?: string;
  Zip?: string;
  PropertyType?: string;
  LastUpdatedAt?: string;
  HiddenAt?: string | null;
}

interface V0Unit {
  Id: string;
  PropertyId?: string;
  Bedrooms?: number | string;
  Bathrooms?: number | string;
  SquareFeet?: number | string;
  ListedRent?: number | string;
  MarketRent?: number | string;
  RentReady?: boolean;
  AvailableOn?: string;
  MarketingDescription?: string;
  AppliancesIncluded?: string[];
}

// ============================================
// Town detection from city
// ============================================

const TOWN_MAP: Record<string, Town> = {
  bend: 'Bend',
  redmond: 'Redmond',
  sisters: 'Sisters',
  prineville: 'Prineville',
  culver: 'Culver',
};

function detectTown(city: string): Town | null {
  const normalized = (city || '').trim().toLowerCase();
  return TOWN_MAP[normalized] || null;
}

// ============================================
// Property type mapping
// ============================================

function mapPropertyType(appfolioType: string): PropertyType {
  const t = (appfolioType || '').toLowerCase();
  if (t.includes('single') || t.includes('house') || t.includes('sfr')) return 'SFR';
  if (t.includes('apartment') || t.includes('apt')) return 'Apartment';
  if (t.includes('townhouse') || t.includes('townhome')) return 'Townhouse';
  if (t.includes('duplex')) return 'Duplex';
  if (t.includes('condo')) return 'Condo';
  if (t.includes('manufactured') || t.includes('mobile')) return 'Manufactured';
  if (t.includes('multi')) return 'Apartment';
  return 'Other';
}

// ============================================
// Number parsing (v0 API returns some as strings)
// ============================================

function parseNumber(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(/[^0-9.-]/g, ''));
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

// ============================================
// Fetch Properties (paginated)
// ============================================

async function fetchAllProperties(
  clientId: string,
  clientSecret: string,
  developerId: string
): Promise<V0Property[]> {
  const allProperties: V0Property[] = [];
  let pageNumber = 1;
  const pageSize = 1000;

  while (true) {
    console.log(`[AppFolio] Fetching properties page ${pageNumber}...`);
    const res = await v0Fetch<V0Property>(
      '/properties',
      {
        'filters[LastUpdatedAtFrom]': '1970-01-01T00:00:00Z',
        'page[number]': String(pageNumber),
        'page[size]': String(pageSize),
      },
      clientId,
      clientSecret,
      developerId
    );

    const properties = res.data || [];
    allProperties.push(...properties);
    console.log(`[AppFolio] Page ${pageNumber}: ${properties.length} properties`);

    // If we got fewer than pageSize, we're done
    if (properties.length < pageSize || !res.next_page_path) {
      break;
    }
    pageNumber++;

    // Safety: max 10 pages (10,000 properties)
    if (pageNumber > 10) {
      console.warn('[AppFolio] Hit max page limit (10), stopping pagination');
      break;
    }
  }

  return allProperties;
}

// ============================================
// Fetch Units for a Property
// ============================================

async function fetchUnitsForProperty(
  propertyId: string,
  clientId: string,
  clientSecret: string,
  developerId: string
): Promise<V0Unit[]> {
  const res = await v0Fetch<V0Unit>(
    '/units',
    {
      'filters[PropertyId]': propertyId,
      'filters[LastUpdatedAtFrom]': '1970-01-01T00:00:00Z',
      'page[number]': '1',
      'page[size]': '1000',
    },
    clientId,
    clientSecret,
    developerId
  );

  return res.data || [];
}

// ============================================
// Public: Fetch & Map to Comps
// ============================================

export async function fetchAppFolioListings(syncUser: string): Promise<CreateCompInput[]> {
  const config = getConfig();
  if (!config) return [];

  const { clientId, clientSecret, developerId } = config;

  try {
    // Step 1: Fetch all properties
    const allProperties = await fetchAllProperties(clientId, clientSecret, developerId);
    console.log(`[AppFolio] Total properties: ${allProperties.length}`);

    // Step 2: Filter to our Central Oregon service area
    const serviceAreaProperties = allProperties.filter((p) => {
      if (p.HiddenAt) return false; // Skip hidden/inactive properties
      const town = detectTown(p.City || '');
      return town !== null;
    });
    console.log(`[AppFolio] Properties in service area: ${serviceAreaProperties.length}`);

    // Step 3: For each service area property, fetch units
    const comps: CreateCompInput[] = [];
    let unitCount = 0;

    for (const property of serviceAreaProperties) {
      const town = detectTown(property.City || '')!;
      const address = [property.Address1, property.Address2].filter(Boolean).join(', ');
      const fullAddress = [address, property.City, property.State, property.Zip]
        .filter(Boolean)
        .join(', ');

      try {
        const units = await fetchUnitsForProperty(
          property.Id,
          clientId,
          clientSecret,
          developerId
        );
        unitCount += units.length;

        for (const unit of units) {
          const rent = parseNumber(unit.ListedRent) || parseNumber(unit.MarketRent);
          if (!rent || rent <= 0) continue;

          const bedrooms = Math.round(parseNumber(unit.Bedrooms));
          const bathrooms = parseNumber(unit.Bathrooms);
          const rawSqft = parseNumber(unit.SquareFeet);
          const sqft = rawSqft ? Math.round(rawSqft) : undefined;

          comps.push({
            town,
            address: fullAddress || undefined,
            zip_code: property.Zip || undefined,
            bedrooms,
            bathrooms: bathrooms || undefined,
            sqft,
            property_type: mapPropertyType(property.PropertyType || ''),
            amenities: unit.AppliancesIncluded || [],
            monthly_rent: rent,
            rent_per_sqft:
              sqft && sqft > 0
                ? Math.round((rent / sqft) * 10000) / 10000
                : undefined,
            data_source: 'appfolio',
            comp_date: new Date().toISOString().split('T')[0],
            external_id: `appfolio-${property.Id}-${unit.Id}`,
            created_by: syncUser,
          });
        }
      } catch (err) {
        console.error(`[AppFolio] Error fetching units for property ${property.Id}:`, err);
        // Continue with other properties
      }
    }

    console.log(
      `[AppFolio] Fetched ${unitCount} units across ${serviceAreaProperties.length} properties`
    );
    console.log(`[AppFolio] Mapped ${comps.length} comps with rent data`);
    return comps;
  } catch (err) {
    console.error('[AppFolio] Sync error:', err);
    throw err;
  }
}
