/**
 * AppFolio Partner API Client
 *
 * Fetches listing and lease data from AppFolio's Partner API,
 * maps to our rental_comps schema for nightly sync.
 *
 * Uses the same credentials as the Konmashi integration.
 *
 * Required env vars:
 *   APPFOLIO_CLIENT_ID
 *   APPFOLIO_CLIENT_SECRET
 *   APPFOLIO_API_BASE_URL (e.g. "https://highdesertpm.appfolio.com/partner_api/v1")
 */

import type { CreateCompInput, Town, PropertyType } from '@/types/comps';

// ============================================
// Config
// ============================================

function getConfig() {
  const clientId = process.env.APPFOLIO_CLIENT_ID;
  const clientSecret = process.env.APPFOLIO_CLIENT_SECRET;
  const baseUrl = process.env.APPFOLIO_API_BASE_URL;

  if (!clientId || !clientSecret || !baseUrl) {
    console.warn('[AppFolio] Missing API credentials — sync will be skipped');
    return null;
  }

  return { clientId, clientSecret, baseUrl };
}

function getAuthHeader(clientId: string, clientSecret: string) {
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  return `Basic ${encoded}`;
}

// ============================================
// Town detection from address
// ============================================

const TOWN_PATTERNS: { pattern: RegExp; town: Town }[] = [
  { pattern: /\bBend\b/i, town: 'Bend' },
  { pattern: /\bRedmond\b/i, town: 'Redmond' },
  { pattern: /\bSisters\b/i, town: 'Sisters' },
  { pattern: /\bPrineville\b/i, town: 'Prineville' },
  { pattern: /\bCulver\b/i, town: 'Culver' },
];

function detectTown(address: string): Town | null {
  for (const { pattern, town } of TOWN_PATTERNS) {
    if (pattern.test(address)) return town;
  }
  return null;
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
  return 'Other';
}

// ============================================
// Zip code extraction
// ============================================

function extractZip(address: string): string | undefined {
  const match = address.match(/\b(97\d{3})\b/);
  return match ? match[1] : undefined;
}

// ============================================
// API Fetching — Partner API
// ============================================

interface AppFolioListing {
  id: string | number;
  address?: string;
  full_address?: string;
  address_line_1?: string;
  city?: string;
  state?: string;
  zip?: string;
  zip_code?: string;
  property_type?: string;
  unit_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  square_footage?: number;
  market_rent?: number;
  listed_rent?: number;
  rent?: number;
  actual_rent?: number;
  status?: string;
  amenities?: string[];
}

async function fetchFromAppFolio(
  endpoint: string,
  baseUrl: string,
  clientId: string,
  clientSecret: string
): Promise<unknown[]> {
  const url = `${baseUrl}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(clientId, clientSecret),
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AppFolio Partner API error (${res.status}): ${text}`);
  }

  const json = await res.json();
  // Partner API responses vary — handle array or nested data
  if (Array.isArray(json)) return json;
  if (json.data && Array.isArray(json.data)) return json.data;
  if (json.results && Array.isArray(json.results)) return json.results;
  if (json.listings && Array.isArray(json.listings)) return json.listings;
  if (json.units && Array.isArray(json.units)) return json.units;
  return [];
}

// ============================================
// Public: Fetch & Map Listings
// ============================================

export async function fetchAppFolioListings(syncUser: string): Promise<CreateCompInput[]> {
  const config = getConfig();
  if (!config) return [];

  const { clientId, clientSecret, baseUrl } = config;

  try {
    // Try /listings first, fall back to /units if needed
    let listings: AppFolioListing[] = [];

    try {
      listings = (await fetchFromAppFolio(
        '/listings.json',
        baseUrl,
        clientId,
        clientSecret
      )) as AppFolioListing[];
    } catch {
      console.log('[AppFolio] /listings.json not available, trying /units.json...');
      listings = (await fetchFromAppFolio(
        '/units.json',
        baseUrl,
        clientId,
        clientSecret
      )) as AppFolioListing[];
    }

    console.log(`[AppFolio] Fetched ${listings.length} listings`);

    const comps: CreateCompInput[] = [];

    for (const listing of listings) {
      const address = listing.full_address || listing.address_line_1 || listing.address || '';
      const town = detectTown(listing.city || address);
      if (!town) continue; // Skip if not in our service area

      const rent = listing.market_rent || listing.listed_rent || listing.rent || listing.actual_rent;
      if (!rent || rent <= 0) continue;

      const bedrooms = listing.bedrooms ?? 0;
      const sqft = listing.square_feet || listing.square_footage || undefined;

      comps.push({
        town,
        address: address || undefined,
        zip_code: listing.zip || listing.zip_code || extractZip(address),
        bedrooms,
        bathrooms: listing.bathrooms,
        sqft,
        property_type: mapPropertyType(listing.property_type || listing.unit_type || ''),
        amenities: listing.amenities || [],
        monthly_rent: rent,
        rent_per_sqft: sqft && sqft > 0 ? Math.round((rent / sqft) * 10000) / 10000 : undefined,
        data_source: 'appfolio',
        comp_date: new Date().toISOString().split('T')[0],
        external_id: `appfolio-${listing.id}`,
        created_by: syncUser,
      });
    }

    console.log(`[AppFolio] Mapped ${comps.length} comps in service area`);
    return comps;
  } catch (err) {
    console.error('[AppFolio] Sync error:', err);
    throw err;
  }
}
