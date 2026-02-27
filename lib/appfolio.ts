/**
 * AppFolio API Client
 *
 * Fetches listing and lease data from AppFolio's API,
 * maps to our rental_comps schema for nightly sync.
 *
 * Required env vars:
 *   APPFOLIO_CLIENT_ID
 *   APPFOLIO_CLIENT_SECRET
 *   APPFOLIO_DOMAIN (e.g. "hdpm")
 */

import type { CreateCompInput, Town, PropertyType } from '@/types/comps';

// ============================================
// Config
// ============================================

function getConfig() {
  const clientId = process.env.APPFOLIO_CLIENT_ID;
  const clientSecret = process.env.APPFOLIO_CLIENT_SECRET;
  const domain = process.env.APPFOLIO_DOMAIN;

  if (!clientId || !clientSecret || !domain) {
    // HDPM-TODO: Set APPFOLIO_CLIENT_ID, APPFOLIO_CLIENT_SECRET, APPFOLIO_DOMAIN in .env.local
    console.warn('[AppFolio] Missing API credentials — sync will be skipped');
    return null;
  }

  return { clientId, clientSecret, domain };
}

function getBaseUrl(domain: string) {
  return `https://${domain}.appfolio.com/api/v1`;
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
// API Fetching
// ============================================

interface AppFolioListing {
  id: string | number;
  address?: string;
  full_address?: string;
  city?: string;
  state?: string;
  zip?: string;
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  market_rent?: number;
  listed_rent?: number;
  status?: string;
  amenities?: string[];
}

async function fetchFromAppFolio(
  endpoint: string,
  domain: string,
  clientId: string,
  clientSecret: string
): Promise<unknown[]> {
  const url = `${getBaseUrl(domain)}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(clientId, clientSecret),
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AppFolio API error (${res.status}): ${text}`);
  }

  const json = await res.json();
  // AppFolio responses vary — handle array or nested data
  if (Array.isArray(json)) return json;
  if (json.data && Array.isArray(json.data)) return json.data;
  if (json.results && Array.isArray(json.results)) return json.results;
  return [];
}

// ============================================
// Public: Fetch & Map Listings
// ============================================

export async function fetchAppFolioListings(syncUser: string): Promise<CreateCompInput[]> {
  const config = getConfig();
  if (!config) return [];

  const { clientId, clientSecret, domain } = config;

  try {
    const listings = (await fetchFromAppFolio(
      '/listings',
      domain,
      clientId,
      clientSecret
    )) as AppFolioListing[];

    console.log(`[AppFolio] Fetched ${listings.length} listings`);

    const comps: CreateCompInput[] = [];

    for (const listing of listings) {
      const address = listing.full_address || listing.address || '';
      const town = detectTown(listing.city || address);
      if (!town) continue; // Skip if not in our service area

      const rent = listing.market_rent || listing.listed_rent;
      if (!rent || rent <= 0) continue;

      const bedrooms = listing.bedrooms ?? 0;
      const sqft = listing.square_feet || undefined;

      comps.push({
        town,
        address: address || undefined,
        zip_code: listing.zip || extractZip(address),
        bedrooms,
        bathrooms: listing.bathrooms,
        sqft,
        property_type: mapPropertyType(listing.property_type || ''),
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
