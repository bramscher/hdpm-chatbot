/**
 * Property Meld API Client
 *
 * OAuth 2.0 client credentials flow + REST API wrapper.
 * Handles token management, pagination, and all core endpoints.
 */

// ============================================
// Types
// ============================================

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface PMProperty {
  id: number;
  created: string;
  updated: string;
  name?: string;
  address?: string;
  address_2?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  property_group?: number;
  [key: string]: unknown;
}

export interface PMUnit {
  id: number;
  created: string;
  updated: string;
  property: number;
  property_id?: number;
  unit?: string;
  name?: string;
  address?: string;
  unit_address?: string;
  is_active?: boolean;
  current_residents?: unknown[];
  [key: string]: unknown;
}

export interface PMMeld {
  id: number;
  created: string;
  updated: string;
  status: string;
  brief_description?: string;
  description?: string;
  unit?: number;
  property?: number;
  vendor?: number;
  assigned_to?: number;
  priority?: string;
  category?: string;
  [key: string]: unknown;
}

export interface PMResident {
  id: number;
  created: string;
  updated: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  unit?: number;
  [key: string]: unknown;
}

export interface PMVendor {
  id: number;
  created: string;
  updated: string;
  name?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface PMOwner {
  id: number;
  created: string;
  updated: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  [key: string]: unknown;
}

export interface PMManagement {
  id: number;
  multitenant_id: number;
  name?: string;
  [key: string]: unknown;
}

export interface PMPaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ============================================
// Token Cache
// ============================================

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

// ============================================
// Core Client
// ============================================

const PM_API_URL = process.env.PROPERTY_MELD_API_URL || 'https://api.propertymeld.com';
const PM_CLIENT_ID = process.env.PROPERTY_MELD_CLIENT_ID || '';
const PM_CLIENT_SECRET = process.env.PROPERTY_MELD_CLIENT_SECRET || '';

/**
 * Get an OAuth 2.0 access token using client_credentials grant.
 * Caches the token until near expiration.
 */
export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  if (!PM_CLIENT_ID || !PM_CLIENT_SECRET) {
    throw new Error('Property Meld credentials not configured (PROPERTY_MELD_CLIENT_ID / PROPERTY_MELD_CLIENT_SECRET)');
  }

  const res = await fetch(`${PM_API_URL}/api/v2/oauth/token/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: PM_CLIENT_ID,
      client_secret: PM_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Property Meld OAuth failed (${res.status}): ${text}`);
  }

  const data: OAuthTokenResponse = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;

  return cachedToken;
}

/**
 * Make an authenticated request to the Property Meld API.
 */
async function pmFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    multitenantId?: number;
    params?: Record<string, string | number>;
  } = {}
): Promise<T> {
  const token = await getAccessToken();
  const { method = 'GET', body, multitenantId, params } = options;

  let url = `${PM_API_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      searchParams.set(key, String(value));
    }
    url += `?${searchParams.toString()}`;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  if (multitenantId) {
    headers['X-Multitenant-Id'] = String(multitenantId);
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Property Meld API error (${res.status} ${path}): ${text}`);
  }

  return res.json();
}

/**
 * Fetch all pages of a paginated endpoint.
 */
async function pmFetchAll<T>(
  path: string,
  multitenantId: number,
  maxPages = 50
): Promise<T[]> {
  const allResults: T[] = [];
  let offset = 0;
  const limit = 100;

  for (let page = 0; page < maxPages; page++) {
    const data = await pmFetch<PMPaginatedResponse<T>>(path, {
      multitenantId,
      params: { limit, offset },
    });

    allResults.push(...data.results);

    if (!data.next || allResults.length >= data.count) {
      break;
    }

    offset += limit;
  }

  return allResults;
}

// ============================================
// API Methods
// ============================================

/**
 * Get management companies (includes multitenant_id).
 */
export async function getManagement(): Promise<PMManagement[]> {
  const data = await pmFetch<PMPaginatedResponse<PMManagement>>('/api/v2/management/');
  return data.results;
}

/**
 * Get the multitenant ID for the first management company.
 */
export async function getMultitenantId(): Promise<number> {
  const mgmt = await getManagement();
  if (mgmt.length === 0) {
    throw new Error('No management companies found in Property Meld');
  }
  // The multitenant_id might be at the top level or nested
  const id = mgmt[0].multitenant_id || mgmt[0].id;
  if (!id) {
    throw new Error('Could not determine multitenant_id from management response');
  }
  return id;
}

/**
 * List all properties.
 */
export async function getProperties(multitenantId: number): Promise<PMProperty[]> {
  return pmFetchAll<PMProperty>('/api/v2/property/', multitenantId);
}

/**
 * List all units.
 */
export async function getUnits(multitenantId: number): Promise<PMUnit[]> {
  return pmFetchAll<PMUnit>('/api/v2/unit/', multitenantId);
}

/**
 * List all melds (work orders).
 */
export async function getMelds(multitenantId: number): Promise<PMMeld[]> {
  return pmFetchAll<PMMeld>('/api/v2/meld/', multitenantId);
}

/**
 * Get a single meld by ID.
 */
export async function getMeld(multitenantId: number, meldId: number): Promise<PMMeld> {
  return pmFetch<PMMeld>(`/api/v2/meld/${meldId}/`, { multitenantId });
}

/**
 * Create a new meld (work order).
 */
export async function createMeld(
  multitenantId: number,
  meldData: Partial<PMMeld>
): Promise<PMMeld> {
  return pmFetch<PMMeld>('/api/v2/meld/', {
    method: 'POST',
    multitenantId,
    body: meldData,
  });
}

/**
 * Complete a meld.
 */
export async function completeMeld(multitenantId: number, meldId: number): Promise<PMMeld> {
  return pmFetch<PMMeld>(`/api/v2/meld/${meldId}/complete/`, {
    method: 'PATCH',
    multitenantId,
  });
}

/**
 * List all residents.
 */
export async function getResidents(multitenantId: number): Promise<PMResident[]> {
  return pmFetchAll<PMResident>('/api/v2/resident/', multitenantId);
}

/**
 * List all vendors.
 */
export async function getVendors(multitenantId: number): Promise<PMVendor[]> {
  return pmFetchAll<PMVendor>('/api/v2/vendor/', multitenantId);
}

/**
 * List all owners.
 */
export async function getOwners(multitenantId: number): Promise<PMOwner[]> {
  return pmFetchAll<PMOwner>('/api/v2/owner/', multitenantId);
}

/**
 * Health check — ping the API.
 */
export async function ping(): Promise<unknown> {
  return pmFetch('/api/v2/ping/');
}

/**
 * Validate the current token.
 */
export async function checkToken(): Promise<unknown> {
  return pmFetch('/api/v2/check_token/');
}
