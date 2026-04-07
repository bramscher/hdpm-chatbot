/**
 * AppFolio KPI Data Fetchers
 *
 * Pulls operational metrics from the AppFolio v0 Database API
 * for the KPI dashboard. Reuses the same credential pattern as
 * lib/appfolio.ts but keeps KPI logic isolated.
 *
 * v0 endpoints used:
 *   /delinquent_charges — delinquency rate (KPI 1)
 *   /leases             — active occupancy count for delinquency denominator
 *   /units              — vacancy rate (KPI 2)
 *   /work_orders        — cycle time (KPI 3)
 *   /tenants            — notice volume (KPI 4)
 *
 * Not available in v0:
 *   /occupancies (404)  — insurance compliance data not exposed
 */

const APPFOLIO_V0_BASE = 'https://api.appfolio.com/api/v0';

// ============================================
// Config & Auth
// ============================================

interface AppFolioConfig {
  auth: string;
  developerId: string;
}

function getKpiConfig(): AppFolioConfig | null {
  const clientId = process.env.APPFOLIO_CLIENT_ID;
  const clientSecret = process.env.APPFOLIO_CLIENT_SECRET;
  const developerId = process.env.APPFOLIO_DEVELOPER_ID;

  if (!clientId || !clientSecret || !developerId) {
    console.warn('[KPI] Missing AppFolio API credentials');
    return null;
  }

  return {
    auth: Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    developerId,
  };
}

// ============================================
// v0 Fetch (same pattern as lib/appfolio.ts)
// ============================================

interface V0ListResponse<T> {
  data: T[];
  next_page_path?: string | null;
}

async function v0Fetch<T>(
  path: string,
  params: Record<string, string>,
  config: AppFolioConfig
): Promise<V0ListResponse<T>> {
  const url = new URL(`${APPFOLIO_V0_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Basic ${config.auth}`,
      'X-AppFolio-Developer-ID': config.developerId,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`AppFolio v0 error (${response.status}): ${text.substring(0, 300)}`);
  }

  return JSON.parse(text) as V0ListResponse<T>;
}

async function v0FetchAll<T>(
  path: string,
  params: Record<string, string>,
  config: AppFolioConfig,
  pageSize = 200,
  maxPages = 50
): Promise<T[]> {
  const all: T[] = [];
  let pageNumber = 1;

  while (true) {
    const res = await v0Fetch<T>(
      path,
      { ...params, 'page[number]': String(pageNumber), 'page[size]': String(pageSize) },
      config
    );

    all.push(...(res.data || []));
    if ((res.data || []).length < pageSize || !res.next_page_path) break;
    pageNumber++;
    if (pageNumber > maxPages) break;
  }

  return all;
}

// ============================================
// v0 Types (subset needed for KPIs)
// ============================================

interface V0DelinquentCharge {
  Id: string;
  AmountDue: string;
  ChargedOn: string;
  Description: string;
  OccupancyId: string;
  LastUpdatedAt: string;
}

interface V0Lease {
  Id: string;
  OccupancyId: string;
  Status: string;
  StartOn: string;
  EndOn: string | null;
  IsMtm: boolean;
  LastUpdatedAt: string;
}

interface V0Unit {
  Id: string;
  PropertyId?: string;
  Status?: string;
  HiddenAt?: string | null;
}

interface V0WorkOrder {
  Id: string;
  Status?: string;
  CreatedAt?: string;
  CompletedOn?: string;
  LastUpdatedAt?: string;
}

interface V0Tenant {
  Id: string;
  PropertyId?: string;
  UnitId?: string;
  Status?: string;
  MoveOutOn?: string;
  HiddenAt?: string | null;
  LastUpdatedAt?: string;
}

// ============================================
// KPI 1: Delinquency Rate
// ============================================

export interface DelinquencyKpi {
  rate: number;
  totalDollars: number;
  count: number;
}

export async function fetchDelinquencyKpi(): Promise<DelinquencyKpi> {
  const config = getKpiConfig();
  if (!config) {
    return { rate: 0, totalDollars: 0, count: 0 };
  }

  // Fetch all open delinquent charges (no date filter needed — endpoint returns current open charges)
  const charges = await v0FetchAll<V0DelinquentCharge>(
    '/delinquent_charges',
    {},
    config
  );

  // Fetch active leases to get total occupancy count (denominator)
  const leases = await v0FetchAll<V0Lease>(
    '/leases',
    { 'filters[LastUpdatedAtFrom]': '2020-01-01T00:00:00Z' },
    config
  );

  const activeOccupancies = new Set(
    leases.filter((l) => l.Status === 'Fully Executed').map((l) => l.OccupancyId)
  );

  const delinquentOccupancies = new Set(charges.map((c) => c.OccupancyId));
  const totalDollars = charges.reduce((sum, c) => sum + parseFloat(c.AmountDue || '0'), 0);
  const count = delinquentOccupancies.size;
  const totalActive = activeOccupancies.size;

  const rate = totalActive > 0
    ? Math.round((count / totalActive) * 1000) / 10
    : 0;

  return {
    rate,
    totalDollars: Math.round(totalDollars * 100) / 100,
    count,
  };
}

// ============================================
// KPI 2: Vacancy Rate
// ============================================

export interface VacancyKpi {
  rate: number;
  vacantCount: number;
  totalUnits: number;
}

export async function fetchVacancyKpi(): Promise<VacancyKpi> {
  const config = getKpiConfig();
  if (!config) {
    return { rate: 0, vacantCount: 0, totalUnits: 0 };
  }

  const units = await v0FetchAll<V0Unit>(
    '/units',
    { 'filters[LastUpdatedAtFrom]': '2000-01-01T00:00:00Z' },
    config
  );

  const activeUnits = units.filter((u) => !u.HiddenAt);
  const totalUnits = activeUnits.length;

  const vacantCount = activeUnits.filter((u) => {
    const status = (u.Status || '').toLowerCase();
    return status.includes('vacant') || status.includes('available');
  }).length;

  const rate = totalUnits > 0 ? Math.round((vacantCount / totalUnits) * 1000) / 10 : 0;

  return { rate, vacantCount, totalUnits };
}

// ============================================
// KPI 3: Work Order Cycle Time
// ============================================

export interface WorkOrderKpi {
  avgDaysToClose: number;
  openCount: number;
}

export async function fetchWorkOrderKpi(): Promise<WorkOrderKpi> {
  const config = getKpiConfig();
  if (!config) {
    return { avgDaysToClose: 0, openCount: 0 };
  }

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 90);

  const workOrders = await v0FetchAll<V0WorkOrder>(
    '/work_orders',
    { 'filters[LastUpdatedAtFrom]': sinceDate.toISOString() },
    config
  );

  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const closedRecently = workOrders.filter((wo) => {
    if (!wo.CompletedOn) return false;
    const completed = new Date(wo.CompletedOn);
    return completed >= thirtyDaysAgo && completed <= now;
  });

  let avgDaysToClose = 0;
  if (closedRecently.length > 0) {
    const totalDays = closedRecently.reduce((sum, wo) => {
      const created = wo.CreatedAt ? new Date(wo.CreatedAt) : now;
      const completed = new Date(wo.CompletedOn!);
      const days = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      return sum + Math.max(0, days);
    }, 0);
    avgDaysToClose = Math.round((totalDays / closedRecently.length) * 10) / 10;
  }

  const openCount = workOrders.filter((wo) => {
    const status = (wo.Status || '').toLowerCase();
    return (
      !status.includes('completed') &&
      !status.includes('complete') &&
      !status.includes('canceled') &&
      !status.includes('cancelled') &&
      !status.includes('closed')
    );
  }).length;

  return { avgDaysToClose, openCount };
}

// ============================================
// KPI 4: 30-Day Notice Volume
// ============================================

export interface NoticeKpi {
  thisWeek: number;
  last30Days: number;
}

export async function fetchNoticeKpi(): Promise<NoticeKpi> {
  const config = getKpiConfig();
  if (!config) {
    return { thisWeek: 0, last30Days: 0 };
  }

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 90);

  const tenants = await v0FetchAll<V0Tenant>(
    '/tenants',
    { 'filters[LastUpdatedAtFrom]': sinceDate.toISOString() },
    config
  );

  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Week boundaries (Monday to Sunday)
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  let thisWeek = 0;
  let last30Days = 0;

  for (const t of tenants) {
    if (t.HiddenAt || !t.MoveOutOn) continue;

    // Only count tenants currently in "Notice" status (active 30-day notices)
    // or with a future MoveOutOn date (pending move-out).
    // Excludes "Past" (already moved out) and "Evict" tenants.
    const status = (t.Status || '').toLowerCase();
    if (status !== 'notice') continue;

    const moveOut = new Date(t.MoveOutOn);

    // Count notices with move-out in the last 30 days or upcoming
    if (moveOut >= thirtyDaysAgo) {
      last30Days++;
      if (moveOut >= weekStart && moveOut < weekEnd) {
        thisWeek++;
      }
    }
  }

  return { thisWeek, last30Days };
}

// ============================================
// KPI 5: Insurance Compliance Rate
// ============================================

export interface InsuranceKpi {
  rate: number;
  compliantCount: number;
  totalCount: number;
}

/**
 * TODO: AppFolio v0 API does not expose renter's insurance status.
 * The /occupancies endpoint returns 404 in v0.
 * Returning mock data so the dashboard renders.
 * Replace with real API call if AppFolio adds insurance fields to /tenants or /leases.
 */
export async function fetchInsuranceKpi(): Promise<InsuranceKpi> {
  const config = getKpiConfig();
  if (!config) {
    return { rate: 0, compliantCount: 0, totalCount: 0 };
  }

  // TODO: Replace with real endpoint when available
  return {
    rate: 78.5,
    compliantCount: 112,
    totalCount: 143,
  };
}

// ============================================
// KPI 6: Owner Retention Rate
// ============================================

export interface OwnerRetentionKpi {
  rate: number;
  cancellationsLast30Days: number;
  totalOwners: number;
}

/**
 * TODO: Requires joining /owners + /owner_groups to determine active vs churned owners.
 * The /owner_groups endpoint has a Current boolean and ContractExpiration field.
 * Returning mock data while the real computation is built.
 */
export async function fetchOwnerRetentionKpi(): Promise<OwnerRetentionKpi> {
  const config = getKpiConfig();
  if (!config) {
    return { rate: 0, cancellationsLast30Days: 0, totalOwners: 0 };
  }

  // TODO: Replace with real /owners + /owner_groups computation
  return {
    rate: 94.2,
    cancellationsLast30Days: 1,
    totalOwners: 87,
  };
}

// ============================================
// KPI 7: Maintenance Cost as % of Rent Roll
// ============================================

export interface MaintenanceCostKpi {
  rate: number;
  maintenanceDollars: number;
  grossRentDollars: number;
}

/**
 * TODO: Requires /bills (maintenance spend) + /recurring_charges (rent roll).
 * Both endpoints are available in v0 but need multi-page fetching and
 * GL account filtering to isolate maintenance-specific bills.
 * Returning mock data while the real computation is built.
 */
export async function fetchMaintenanceCostKpi(): Promise<MaintenanceCostKpi> {
  const config = getKpiConfig();
  if (!config) {
    return { rate: 0, maintenanceDollars: 0, grossRentDollars: 0 };
  }

  // TODO: Replace with real /bills + /recurring_charges computation
  return {
    rate: 11.3,
    maintenanceDollars: 42850,
    grossRentDollars: 379200,
  };
}

// ============================================
// KPI 8: Average Days to Lease
// ============================================

export interface DaysToLeaseKpi {
  avgDays: number;
  fastest: number;
  slowest: number;
  unitsLeased: number;
}

/**
 * TODO: Requires tracking unit status transitions (vacant → occupied)
 * over time. The v0 /units endpoint has Status and AvailableOn fields,
 * and /leases has SignedOn. Could compute by matching lease sign dates
 * against unit available dates. Returning mock data for now.
 */
export async function fetchDaysToLeaseKpi(): Promise<DaysToLeaseKpi> {
  const config = getKpiConfig();
  if (!config) {
    return { avgDays: 0, fastest: 0, slowest: 0, unitsLeased: 0 };
  }

  // TODO: Replace with real computation from /units + /leases
  return {
    avgDays: 18.4,
    fastest: 3,
    slowest: 42,
    unitsLeased: 12,
  };
}

// ============================================
// KPI 9: Lease Renewal Rate
// ============================================

export interface LeaseRenewalKpi {
  rate: number;
  renewals: number;
  moveOuts: number;
}

/**
 * TODO: The /leases endpoint has RenewedOn and Status fields.
 * Could count leases with RenewedOn in the last 90 days as renewals,
 * and tenants with MoveOutOn as move-outs. Returning mock data for now.
 */
export async function fetchLeaseRenewalKpi(): Promise<LeaseRenewalKpi> {
  const config = getKpiConfig();
  if (!config) {
    return { rate: 0, renewals: 0, moveOuts: 0 };
  }

  // TODO: Replace with real /leases + /tenants computation
  return {
    rate: 67.8,
    renewals: 19,
    moveOuts: 9,
  };
}

// ============================================
// KPI 10: Net Doors Added
// ============================================

export interface NetDoorsKpi {
  currentDoors: number;
  netThisMonth: number;
}

export async function fetchNetDoorsKpi(): Promise<NetDoorsKpi> {
  const config = getKpiConfig();
  if (!config) {
    return { currentDoors: 0, netThisMonth: 0 };
  }

  // Get current total unit count from live API
  const units = await v0FetchAll<V0Unit>(
    '/units',
    { 'filters[LastUpdatedAtFrom]': '2000-01-01T00:00:00Z' },
    config
  );

  const currentDoors = units.filter((u) => !u.HiddenAt).length;

  // Net this month is computed from snapshot delta — on first run, default to 0.
  // The cron job captures daily snapshots; month-over-month diff is computed client-side.
  // TODO: Compare against last month's snapshot for netThisMonth
  return {
    currentDoors,
    netThisMonth: 0,
  };
}
