/**
 * Rentometer API Client
 *
 * On-demand rent comparisons for Bend and Redmond only.
 * Results are cached for 30 days in the rental_comps table.
 *
 * API docs: https://www.rentometer.com/api
 *
 * Required env vars:
 *   RENTOMETER_API_KEY
 */

import type { RentometerResult, Town } from '@/types/comps';

// ============================================
// Config
// ============================================

const RENTOMETER_BASE = 'https://www.rentometer.com/api/v1';

// Rentometer only has reliable data for these Central Oregon cities
const SUPPORTED_CITIES: Town[] = ['Bend', 'Redmond'];

const CACHE_DAYS = 30;

function getApiKey(): string | null {
  const key = process.env.RENTOMETER_API_KEY;
  if (!key) {
    // HDPM-TODO: Set RENTOMETER_API_KEY in .env.local
    console.warn('[Rentometer] Missing API key — lookups will be skipped');
    return null;
  }
  return key;
}

// ============================================
// Validation
// ============================================

export function isSupportedCity(town: string): boolean {
  return SUPPORTED_CITIES.includes(town as Town);
}

// ============================================
// API Types
// ============================================

interface RentometerApiResponse {
  mean?: number;
  median?: number;
  percentile_25?: number;
  percentile_75?: number;
  min?: number;
  max?: number;
  samples?: number;
  address?: string;
  city?: string;
  state?: string;
}

// ============================================
// Quick View (summary stats for an area)
// ============================================

export async function quickView(
  address: string,
  city: Town,
  bedrooms: number
): Promise<RentometerResult | null> {
  if (!isSupportedCity(city)) {
    console.warn(`[Rentometer] ${city} is not supported — only Bend & Redmond`);
    return null;
  }

  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      address: `${address}, ${city}, OR`,
      bedrooms: bedrooms.toString(),
    });

    const res = await fetch(`${RENTOMETER_BASE}/summary?${params}`, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Rentometer API error (${res.status}): ${text}`);
    }

    const data: RentometerApiResponse = await res.json();

    return {
      mean: data.mean || 0,
      median: data.median || 0,
      percentile_25: data.percentile_25 || 0,
      percentile_75: data.percentile_75 || 0,
      min: data.min || 0,
      max: data.max || 0,
      sample_size: data.samples || 0,
      address: data.address || address,
      city: data.city || city,
      state: data.state || 'OR',
      bedrooms,
    };
  } catch (err) {
    console.error('[Rentometer] Quick view error:', err);
    throw err;
  }
}

// ============================================
// Cache Expiration Helper
// ============================================

export function getCacheExpiration(): string {
  const expires = new Date();
  expires.setDate(expires.getDate() + CACHE_DAYS);
  return expires.toISOString();
}

export function isCacheValid(cachedUntil: string | null): boolean {
  if (!cachedUntil) return false;
  return new Date(cachedUntil) > new Date();
}
