/**
 * Owner Report Module
 *
 * Fetches property and tenant data from AppFolio, groups by owner,
 * and assembles a per-property rent history timeline for owner reports.
 *
 * Data sources:
 *   - AppFolio v0 /properties  → property details + owner name
 *   - AppFolio v0 /tenants     → tenant records with move-in, rent, lease dates
 *   - AppFolio v0 /units       → unit details (beds, baths, sqft)
 */

import {
  fetchAllPropertiesPublic,
  fetchAppFolioTenants,
  fetchAppFolioUnits,
  type AppFolioTenant,
  type AppFolioUnit,
} from './appfolio';

// ============================================
// Types
// ============================================

export interface OwnerProperty {
  propertyId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  units: OwnerUnit[];
}

export interface OwnerUnit {
  unitId: string;
  unitName: string | null;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  currentRent: number | null;
  tenantHistory: TenantRecord[];
}

export interface TenantRecord {
  tenantId: string;
  tenantName: string;
  moveInDate: string | null;
  moveOutDate: string | null;
  leaseStartDate: string | null;
  leaseEndDate: string | null;
  rent: number | null;
  status: string;
  isCurrent: boolean;
}

export interface OwnerReport {
  ownerName: string;
  generatedAt: string;
  properties: OwnerProperty[];
  summary: OwnerReportSummary;
}

export interface OwnerReportSummary {
  totalProperties: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  totalMonthlyRent: number;
  avgRentPerUnit: number;
  longestTenancy: { tenantName: string; years: number } | null;
}

// ============================================
// Helpers
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

function normalizeForMatch(s: string): string {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Fuzzy match an owner name query against an owner field.
 * Returns true if all query words appear in the target.
 */
function ownerMatches(query: string, target: string): boolean {
  const q = normalizeForMatch(query);
  const t = normalizeForMatch(target);
  if (!q || !t) return false;
  if (t.includes(q)) return true;
  const queryWords = q.split(' ').filter(Boolean);
  return queryWords.every(w => t.includes(w));
}

// ============================================
// Data Fetching
// ============================================

interface V0PropertyRaw {
  Id: string;
  Name?: string;
  Address1?: string;
  Address2?: string;
  City?: string;
  State?: string;
  Zip?: string;
  PropertyType?: string;
  HiddenAt?: string | null;
  // Owner fields from AppFolio v0 API
  OwnerName?: string;
  Owner?: string;
  OwnerFirstName?: string;
  OwnerLastName?: string;
  PropertyGroupName?: string;
  [key: string]: unknown;
}

/**
 * Extract owner name from a raw AppFolio property record.
 * Tries multiple possible field names since the v0 API
 * may use different naming conventions.
 */
function extractOwnerName(prop: V0PropertyRaw): string {
  // Try explicit owner fields
  if (prop.OwnerName) return prop.OwnerName;
  if (prop.Owner) return String(prop.Owner);
  if (prop.OwnerFirstName || prop.OwnerLastName) {
    return [prop.OwnerFirstName, prop.OwnerLastName].filter(Boolean).join(' ');
  }
  // Some AppFolio setups use PropertyGroupName as owner grouping
  if (prop.PropertyGroupName) return prop.PropertyGroupName;
  return '';
}

/**
 * Get all distinct owner names from AppFolio properties.
 */
export async function getOwnerNames(): Promise<string[]> {
  const properties = await fetchAllPropertiesPublic() as unknown as V0PropertyRaw[];

  const ownerSet = new Set<string>();
  for (const p of properties) {
    if (p.HiddenAt) continue;
    const owner = extractOwnerName(p);
    if (owner) ownerSet.add(owner);
  }

  return Array.from(ownerSet).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
}

/**
 * Search for owners matching a query string.
 * Returns matching owner names.
 */
export async function searchOwners(query: string): Promise<string[]> {
  const allOwners = await getOwnerNames();
  if (!query.trim()) return allOwners;
  return allOwners.filter(name => ownerMatches(query, name));
}

/**
 * Build a full owner report for the given owner name.
 *
 * Fetches all properties belonging to the owner, then fetches
 * tenant history for each property to build a rent timeline.
 */
export async function buildOwnerReport(ownerName: string): Promise<OwnerReport> {
  // Step 1: Fetch all properties and filter by owner
  const allProperties = await fetchAllPropertiesPublic() as unknown as V0PropertyRaw[];
  const ownerProperties = allProperties.filter(p => {
    if (p.HiddenAt) return false;
    const propOwner = extractOwnerName(p);
    return ownerMatches(ownerName, propOwner);
  });

  if (ownerProperties.length === 0) {
    return {
      ownerName,
      generatedAt: new Date().toISOString(),
      properties: [],
      summary: {
        totalProperties: 0,
        totalUnits: 0,
        occupiedUnits: 0,
        vacantUnits: 0,
        totalMonthlyRent: 0,
        avgRentPerUnit: 0,
        longestTenancy: null,
      },
    };
  }

  // Step 2: Fetch all tenants and units in parallel
  const [allTenants, allUnits] = await Promise.all([
    fetchAppFolioTenants(),
    fetchAppFolioUnits(),
  ]);

  // Build lookups
  const tenantsByProperty = new Map<string, AppFolioTenant[]>();
  for (const t of allTenants) {
    if (!t.propertyId) continue;
    if (!tenantsByProperty.has(t.propertyId)) {
      tenantsByProperty.set(t.propertyId, []);
    }
    tenantsByProperty.get(t.propertyId)!.push(t);
  }

  const unitsByProperty = new Map<string, AppFolioUnit[]>();
  for (const u of allUnits) {
    if (!u.propertyId) continue;
    if (!unitsByProperty.has(u.propertyId)) {
      unitsByProperty.set(u.propertyId, []);
    }
    unitsByProperty.get(u.propertyId)!.push(u);
  }

  // Step 3: Assemble report properties
  const reportProperties: OwnerProperty[] = [];
  let totalMonthlyRent = 0;
  let occupiedUnits = 0;
  let vacantUnits = 0;
  let longestTenancy: { tenantName: string; years: number } | null = null;

  for (const prop of ownerProperties) {
    const propId = prop.Id;
    const propTenants = tenantsByProperty.get(propId) || [];
    const propUnits = unitsByProperty.get(propId) || [];

    // Group tenants by unit
    const tenantsByUnit = new Map<string, AppFolioTenant[]>();
    for (const t of propTenants) {
      const unitKey = t.unitId || '__no_unit__';
      if (!tenantsByUnit.has(unitKey)) {
        tenantsByUnit.set(unitKey, []);
      }
      tenantsByUnit.get(unitKey)!.push(t);
    }

    // Build unit entries
    const units: OwnerUnit[] = [];

    if (propUnits.length === 0) {
      // Single-family / no explicit units — use all tenants as one "unit"
      const tenants = propTenants;
      const currentTenant = tenants.find(t =>
        t.status.toLowerCase() === 'current' && t.isPrimary
      );

      const tenantHistory = buildTenantHistory(tenants);

      units.push({
        unitId: propId,
        unitName: null,
        bedrooms: 0,
        bathrooms: 0,
        sqft: 0,
        currentRent: currentTenant?.currentRent || null,
        tenantHistory,
      });

      if (currentTenant) {
        occupiedUnits++;
        totalMonthlyRent += currentTenant.currentRent || 0;
      } else {
        vacantUnits++;
      }

      // Track longest tenancy
      longestTenancy = updateLongestTenancy(longestTenancy, tenantHistory);
    } else {
      for (const unit of propUnits) {
        const unitTenants = tenantsByUnit.get(unit.id) || [];
        const currentTenant = unitTenants.find(t =>
          t.status.toLowerCase() === 'current' && t.isPrimary
        );

        const tenantHistory = buildTenantHistory(unitTenants);
        const rawBed = (unit as unknown as Record<string, unknown>).bedrooms;
        const rawBath = (unit as unknown as Record<string, unknown>).bathrooms;
        const rawSqft = (unit as unknown as Record<string, unknown>).sqft;

        units.push({
          unitId: unit.id,
          unitName: unit.name,
          bedrooms: parseNumber(rawBed),
          bathrooms: parseNumber(rawBath),
          sqft: parseNumber(rawSqft),
          currentRent: currentTenant?.currentRent || null,
          tenantHistory,
        });

        if (currentTenant) {
          occupiedUnits++;
          totalMonthlyRent += currentTenant.currentRent || 0;
        } else {
          vacantUnits++;
        }

        longestTenancy = updateLongestTenancy(longestTenancy, tenantHistory);
      }
    }

    reportProperties.push({
      propertyId: propId,
      name: prop.Name || '',
      address: [prop.Address1, prop.Address2].filter(Boolean).join(', '),
      city: prop.City || '',
      state: prop.State || '',
      zip: prop.Zip || '',
      propertyType: prop.PropertyType || '',
      units,
    });
  }

  const totalUnits = occupiedUnits + vacantUnits;

  return {
    ownerName,
    generatedAt: new Date().toISOString(),
    properties: reportProperties,
    summary: {
      totalProperties: reportProperties.length,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      totalMonthlyRent,
      avgRentPerUnit: totalUnits > 0 ? Math.round(totalMonthlyRent / totalUnits) : 0,
      longestTenancy,
    },
  };
}

// ============================================
// Tenant History Helpers
// ============================================

function buildTenantHistory(tenants: AppFolioTenant[]): TenantRecord[] {
  // Only include primary tenants (avoid duplicates for co-tenants)
  const primaryTenants = tenants.filter(t => t.isPrimary);
  // Fallback: if no one is marked primary, include all
  const candidates = primaryTenants.length > 0 ? primaryTenants : tenants;

  const records: TenantRecord[] = candidates.map(t => ({
    tenantId: t.id,
    tenantName: [t.firstName, t.lastName].filter(Boolean).join(' ') || 'Unknown',
    moveInDate: t.moveInOn,
    moveOutDate: t.moveOutOn,
    leaseStartDate: t.leaseStartDate,
    leaseEndDate: t.leaseEndDate,
    rent: t.currentRent,
    status: t.status,
    isCurrent: t.status.toLowerCase() === 'current',
  }));

  // Sort: most recent move-in first
  records.sort((a, b) => {
    const dateA = a.moveInDate || a.leaseStartDate || '0000';
    const dateB = b.moveInDate || b.leaseStartDate || '0000';
    return dateB.localeCompare(dateA);
  });

  return records;
}

function updateLongestTenancy(
  current: { tenantName: string; years: number } | null,
  history: TenantRecord[]
): { tenantName: string; years: number } | null {
  const now = new Date();
  let best = current;

  for (const t of history) {
    if (!t.moveInDate) continue;
    const moveIn = new Date(t.moveInDate);
    const end = t.moveOutDate ? new Date(t.moveOutDate) : now;
    const years = (end.getTime() - moveIn.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

    if (!best || years > best.years) {
      best = { tenantName: t.tenantName, years: Math.round(years * 10) / 10 };
    }
  }

  return best;
}
