/**
 * HUD Fair Market Rent (FMR) API Client
 *
 * Fetches annual FMR values by county for Central Oregon.
 * Free API — https://www.huduser.gov/portal/dataset/fmr-api.html
 *
 * County mapping:
 *   Deschutes County → Bend, Redmond, Sisters
 *   Crook County → Prineville
 *   Jefferson County → Culver
 *
 * Required env vars:
 *   HUD_API_TOKEN
 */

import type { UpsertBaselineInput } from '@/types/comps';

// ============================================
// Config
// ============================================

const HUD_API_BASE = 'https://www.huduser.gov/hudapi/public/fmr';

// FIPS codes for Central Oregon counties
const COUNTIES = [
  { fips: '4101700000', name: 'Deschutes County', county: 'Deschutes' }, // Bend MSA
  { fips: '4101300000', name: 'Crook County', county: 'Crook' },
  { fips: '4103100000', name: 'Jefferson County', county: 'Jefferson' },
];

// Area names to assign based on county
const COUNTY_AREAS: Record<string, string[]> = {
  Deschutes: ['Bend', 'Redmond', 'Sisters'],
  Crook: ['Prineville'],
  Jefferson: ['Culver'],
};

function getToken(): string | null {
  const token = process.env.HUD_API_TOKEN;
  if (!token) {
    // HDPM-TODO: Set HUD_API_TOKEN in .env.local (free at huduser.gov)
    console.warn('[HUD] Missing API token — FMR sync will be skipped');
    return null;
  }
  return token;
}

// ============================================
// API Types
// ============================================

interface HudFmrResponse {
  data?: {
    basicdata?: {
      year?: number;
      Efficiency?: number;
      'One-Bedroom'?: number;
      'Two-Bedroom'?: number;
      'Three-Bedroom'?: number;
      'Four-Bedroom'?: number;
    };
    county_name?: string;
  };
}

// ============================================
// Fetch FMR Data
// ============================================

async function fetchFmrForCounty(
  fips: string,
  year: number,
  token: string
): Promise<HudFmrResponse> {
  const url = `${HUD_API_BASE}/statedata/${fips}?year=${year}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HUD API error (${res.status}): ${text}`);
  }

  return res.json();
}

// ============================================
// Parse FMR values → bedroom map
// ============================================

function parseFmrValues(
  basicdata: HudFmrResponse['data']
): Map<number, number> {
  const bd = basicdata?.basicdata;
  if (!bd) return new Map();

  const map = new Map<number, number>();
  if (bd.Efficiency) map.set(0, bd.Efficiency);
  if (bd['One-Bedroom']) map.set(1, bd['One-Bedroom']);
  if (bd['Two-Bedroom']) map.set(2, bd['Two-Bedroom']);
  if (bd['Three-Bedroom']) map.set(3, bd['Three-Bedroom']);
  if (bd['Four-Bedroom']) map.set(4, bd['Four-Bedroom']);
  return map;
}

// ============================================
// Public: Fetch All FMR Baselines
// ============================================

export async function fetchHudFmrBaselines(
  year?: number
): Promise<UpsertBaselineInput[]> {
  const token = getToken();
  if (!token) return [];

  const dataYear = year || new Date().getFullYear();
  const baselines: UpsertBaselineInput[] = [];

  for (const county of COUNTIES) {
    try {
      console.log(`[HUD] Fetching FMR for ${county.name} (${dataYear})...`);
      const response = await fetchFmrForCounty(county.fips, dataYear, token);

      const fmrValues = parseFmrValues(response.data);
      if (fmrValues.size === 0) {
        console.warn(`[HUD] No FMR data for ${county.name}`);
        continue;
      }

      // Create baseline entries for each area in this county
      const areas = COUNTY_AREAS[county.county] || [];
      for (const areaName of areas) {
        for (const [bedrooms, fmrRent] of fmrValues) {
          baselines.push({
            area_name: areaName,
            county: county.county,
            bedrooms,
            fmr_rent: fmrRent,
            data_year: dataYear,
            source: 'hud_fmr',
          });
        }
      }

      console.log(`[HUD] ${county.name}: ${fmrValues.size} bedroom levels mapped to ${areas.length} areas`);
    } catch (err) {
      console.error(`[HUD] Error fetching ${county.name}:`, err);
      // Continue with other counties
    }
  }

  console.log(`[HUD] Total baselines prepared: ${baselines.length}`);
  return baselines;
}
