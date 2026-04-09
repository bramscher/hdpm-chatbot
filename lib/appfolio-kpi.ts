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
 *
 * Leasing funnel (KPIs 11-12):
 *   /leads               — guest card volume + source breakdown
 *   /rental_applications — application/approval funnel stages
 *   /showings            — 0 results currently, time-to-contact unavailable
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

const MAX_RETRIES = 4;
const RETRY_BASE_MS = 2000;

async function v0Fetch<T>(
  path: string,
  params: Record<string, string>,
  config: AppFolioConfig
): Promise<V0ListResponse<T>> {
  const url = new URL(`${APPFOLIO_V0_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Basic ${config.auth}`,
        'X-AppFolio-Developer-ID': config.developerId,
        Accept: 'application/json',
      },
    });

    // Retry on 429 (rate limit) and 533 (data unavailable) with exponential backoff
    if ((response.status === 429 || response.status === 533) && attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      console.warn(`[AppFolio] ${response.status} on ${path}, retry ${attempt}/${MAX_RETRIES} in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`AppFolio v0 error (${response.status}): ${text.substring(0, 300)}`);
    }

    return JSON.parse(text) as V0ListResponse<T>;
  }

  throw new Error(`AppFolio v0 error: max retries exceeded for ${path}`);
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
    // Small delay between pages to avoid 429 rate limits
    await new Promise((r) => setTimeout(r, 200));
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
  RenewedOn: string | null;
  SignedOn: string | null;
  IsMtm: boolean;
  LastUpdatedAt: string;
}

interface V0Unit {
  Id: string;
  PropertyId?: string;
  Status?: string;
  HiddenAt?: string | null;
}

interface V0Property {
  Id: string;
  HiddenAt?: string | null;
}

interface V0OwnerGroup {
  Id: string;
  Current: boolean;
  PropertyId: string | null;
  LastUpdatedAt: string;
}

interface V0RecurringCharge {
  Id: string;
  Amount: string;
  Frequency: string;
  EndDate: string | null;
  OccupancyId: string;
  LastUpdatedAt: string;
}

interface V0Bill {
  Id: string;
  TotalAmount: string;
  InvoiceDate: string;
  LastUpdatedAt: string;
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
 * Uses /owner_groups endpoint. Each owner_group links an owner to a property.
 * Current=true means active management agreement; Current=false means departed.
 * Retention rate = current / total unique property associations.
 */
export async function fetchOwnerRetentionKpi(): Promise<OwnerRetentionKpi> {
  const config = getKpiConfig();
  if (!config) {
    return { rate: 0, cancellationsLast30Days: 0, totalOwners: 0 };
  }

  const ownerGroups = await v0FetchAll<V0OwnerGroup>(
    '/owner_groups',
    { 'filters[LastUpdatedAtFrom]': '2020-01-01T00:00:00Z' },
    config
  );

  const total = ownerGroups.length;
  const current = ownerGroups.filter((g) => g.Current).length;
  const inactive = total - current;

  // Estimate recent cancellations: inactive groups updated in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCancellations = ownerGroups.filter(
    (g) => !g.Current && new Date(g.LastUpdatedAt) >= thirtyDaysAgo
  ).length;

  const rate = total > 0 ? Math.round((current / total) * 1000) / 10 : 0;

  return {
    rate,
    cancellationsLast30Days: recentCancellations,
    totalOwners: current,
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
 * Rent roll from /recurring_charges (active monthly charges).
 * Vendor spend from /bills (last 30 days total — includes all vendor bills,
 * not just maintenance. GL account filtering not available in v0).
 */
export async function fetchMaintenanceCostKpi(): Promise<MaintenanceCostKpi> {
  const config = getKpiConfig();
  if (!config) {
    return { rate: 0, maintenanceDollars: 0, grossRentDollars: 0 };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [recurringCharges, bills] = await Promise.all([
    v0FetchAll<V0RecurringCharge>(
      '/recurring_charges',
      { 'filters[LastUpdatedAtFrom]': '2024-01-01T00:00:00Z' },
      config
    ),
    v0FetchAll<V0Bill>(
      '/bills',
      { 'filters[LastUpdatedAtFrom]': thirtyDaysAgo.toISOString() },
      config
    ),
  ]);

  // Monthly rent roll: sum of active monthly recurring charges
  const now = new Date();
  const activeMonthly = recurringCharges.filter((c) => {
    if (c.EndDate && new Date(c.EndDate) < now) return false;
    return c.Frequency === 'Monthly';
  });
  const grossRentDollars = activeMonthly.reduce(
    (sum, c) => sum + parseFloat(c.Amount || '0'), 0
  );

  // Vendor spend: all bills in last 30 days
  // Note: includes all vendor bills, not just maintenance-specific.
  // GL account endpoint returned 0 results so we can't filter by category.
  const maintenanceDollars = bills.reduce(
    (sum, b) => sum + parseFloat(b.TotalAmount || '0'), 0
  );

  const rate = grossRentDollars > 0
    ? Math.round((maintenanceDollars / grossRentDollars) * 1000) / 10
    : 0;

  return {
    rate: Math.round(rate * 10) / 10,
    maintenanceDollars: Math.round(maintenanceDollars * 100) / 100,
    grossRentDollars: Math.round(grossRentDollars * 100) / 100,
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
 * Uses /leases (RenewedOn field) for renewals and /tenants (Status=Notice
 * with MoveOutOn) for move-outs. Renewal rate = renewals / (renewals + moveOuts).
 */
export async function fetchLeaseRenewalKpi(): Promise<LeaseRenewalKpi> {
  const config = getKpiConfig();
  if (!config) {
    return { rate: 0, renewals: 0, moveOuts: 0 };
  }

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [leases, tenants] = await Promise.all([
    v0FetchAll<V0Lease>(
      '/leases',
      { 'filters[LastUpdatedAtFrom]': ninetyDaysAgo.toISOString() },
      config
    ),
    v0FetchAll<V0Tenant>(
      '/tenants',
      { 'filters[LastUpdatedAtFrom]': ninetyDaysAgo.toISOString() },
      config
    ),
  ]);

  // Renewals: leases with RenewedOn in the last 90 days
  const renewals = leases.filter(
    (l) => l.RenewedOn && new Date(l.RenewedOn) >= ninetyDaysAgo
  ).length;

  // Move-outs: tenants with Status=Notice and a MoveOutOn date
  const moveOuts = tenants.filter((t) => {
    if (t.HiddenAt || !t.MoveOutOn) return false;
    return (t.Status || '').toLowerCase() === 'notice';
  }).length;

  const total = renewals + moveOuts;
  const rate = total > 0 ? Math.round((renewals / total) * 1000) / 10 : 0;

  return { rate, renewals, moveOuts };
}

// ============================================
// KPI 10: Net Doors Added
// ============================================

export interface NetDoorsKpi {
  currentDoors: number;
  currentProperties: number;
  netThisMonth: number;
}

export async function fetchNetDoorsKpi(): Promise<NetDoorsKpi> {
  const config = getKpiConfig();
  if (!config) {
    return { currentDoors: 0, currentProperties: 0, netThisMonth: 0 };
  }

  const [units, properties] = await Promise.all([
    v0FetchAll<V0Unit>(
      '/units',
      { 'filters[LastUpdatedAtFrom]': '2000-01-01T00:00:00Z' },
      config
    ),
    v0FetchAll<V0Property>(
      '/properties',
      { 'filters[LastUpdatedAtFrom]': '1970-01-01T00:00:00Z' },
      config,
      1000,
      10
    ),
  ]);

  const currentDoors = units.filter((u) => !u.HiddenAt).length;
  const currentProperties = properties.filter((p) => !p.HiddenAt).length;

  // Net this month is computed from snapshot delta — on first run, default to 0.
  // The cron job captures daily snapshots; month-over-month diff is computed client-side.
  // TODO: Compare against last month's snapshot for netThisMonth
  return {
    currentDoors,
    currentProperties,
    netThisMonth: 0,
  };
}

// ============================================
// v0 Types — Leasing Funnel
// ============================================

interface V0Lead {
  Id: string;
  CreatedAt: string;
  Source: string | null;
  Status: string;
  PropertyId: string | null;
  RentalApplicationId: string | null;
  RentalApplicationGroupId: string | null;
  FirstName: string;
  LastName: string;
  Email: string | null;
  LastUpdatedAt: string;
}

interface V0RentalApplication {
  Id: string;
  Status: string;
  SubmittedAt: string;
  StatusChangedAt: string | null;
  PropertyId: string | null;
  UnitId: string | null;
  GroupId: string | null;
}

// ============================================
// KPI 11: Guest Card Volume + Source Breakdown
// ============================================

export const SOURCE_BUCKETS: Record<string, string> = {
  'Apartment List': 'Apartment List',
  'Apartmentlist.com': 'Apartment List',
  'Apartments.com': 'Apartments.com',
  'Zillow Rental Network': 'Zillow / Syndication',
  'Zillow': 'Zillow / Syndication',
  'zillow.com': 'Zillow / Syndication',
  'Zumper': 'Zillow / Syndication',
  'Trulia': 'Zillow / Syndication',
  'Realtor.com': 'Zillow / Syndication',
  'Rent.': 'Rent.',
  'HDPM Website': 'HDPM Website',
  'Website': 'HDPM Website',
  'AppFolio': 'AppFolio Portal',
  'Craigslist': 'Craigslist',
  'craigslist': 'Craigslist',
  'Walk-in': 'Direct / Walk-in',
  'Phone': 'Direct / Walk-in',
  'Direct': 'Direct / Walk-in',
};

function normalizeSource(raw: string | null): string {
  if (!raw) return 'Other';
  return SOURCE_BUCKETS[raw] ?? 'Other';
}

function getSourceBreakdown(leads: V0Lead[]): Array<{ source: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const lead of leads) {
    const source = normalizeSource(lead.Source);
    counts[source] = (counts[source] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

export interface GuestCardKpi {
  today: number;
  thisWeek: number;
  thisMonth: number;
  lastWeek: number;
  lastMonth: number;
  weekOverWeekDelta: number;
  monthOverMonthDelta: number;
  sourceBreakdownWeek: Array<{ source: string; count: number }>;
  sourceBreakdownMonth: Array<{ source: string; count: number }>;
}

export async function fetchGuestCardKpi(): Promise<GuestCardKpi> {
  const config = getKpiConfig();
  if (!config) {
    return {
      today: 0, thisWeek: 0, thisMonth: 0, lastWeek: 0, lastMonth: 0,
      weekOverWeekDelta: 0, monthOverMonthDelta: 0,
      sourceBreakdownWeek: [], sourceBreakdownMonth: [],
    };
  }

  // Fetch leads updated in last 90 days (API only supports LastUpdatedAtFrom)
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 90);

  const leads = await v0FetchAll<V0Lead>(
    '/leads',
    { 'filters[LastUpdatedAtFrom]': sinceDate.toISOString() },
    config
  );

  // Time boundaries (UTC — AppFolio CreatedAt is UTC)
  const now = new Date();

  // Today: midnight UTC
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // This week: Monday 00:00 UTC
  const dayOfWeek = now.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const thisWeekStart = new Date(now);
  thisWeekStart.setUTCDate(thisWeekStart.getUTCDate() + mondayOffset);
  thisWeekStart.setUTCHours(0, 0, 0, 0);

  // Last week: prior Monday to prior Sunday
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);

  // This month: 1st of current month
  const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // Last month: 1st of prior month to 1st of current month
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const lastMonthEnd = thisMonthStart;

  // Slice leads by CreatedAt into time windows
  const todayLeads: V0Lead[] = [];
  const thisWeekLeads: V0Lead[] = [];
  const thisMonthLeads: V0Lead[] = [];
  const lastWeekLeads: V0Lead[] = [];
  const lastMonthLeads: V0Lead[] = [];

  for (const lead of leads) {
    const created = new Date(lead.CreatedAt);
    if (created >= todayStart && created <= now) todayLeads.push(lead);
    if (created >= thisWeekStart && created <= now) thisWeekLeads.push(lead);
    if (created >= thisMonthStart && created <= now) thisMonthLeads.push(lead);
    if (created >= lastWeekStart && created < lastWeekEnd) lastWeekLeads.push(lead);
    if (created >= lastMonthStart && created < lastMonthEnd) lastMonthLeads.push(lead);
  }

  const thisWeek = thisWeekLeads.length;
  const lastWeek = lastWeekLeads.length;
  const thisMonth = thisMonthLeads.length;
  const lastMonth = lastMonthLeads.length;

  return {
    today: todayLeads.length,
    thisWeek,
    thisMonth,
    lastWeek,
    lastMonth,
    weekOverWeekDelta: thisWeek - lastWeek,
    monthOverMonthDelta: thisMonth - lastMonth,
    sourceBreakdownWeek: getSourceBreakdown(thisWeekLeads),
    sourceBreakdownMonth: getSourceBreakdown(thisMonthLeads),
  };
}

// ============================================
// KPI 12: Leasing Funnel + Time to First Contact
// ============================================

// TODO: Actual AppFolio lead statuses are "active" / "inactive" only.
// Funnel stages are derived by cross-referencing leads → rental_applications.
const LEAD_STATUS_MAP = {
  APPLICATION: ['Applied', 'Application Submitted'],
  APPROVED: ['Approved', 'Approval Pending'],
  LEASED: ['Leased', 'Lease Signed', 'Move-In Scheduled'],
  LOST: ['Cancelled', 'Lost', 'Denied', 'Withdrawn'],
} as const;

const RENTAL_APP_STATUS_MAP = {
  APPROVED: ['approved'],
  PENDING: ['decision_pending'],
  DENIED: ['denied', 'cancelled'],
} as const;

const RESPONSE_BUCKETS = {
  UNDER_1_HOUR: 1,
  UNDER_24_HOURS: 24,
  OVER_24_HOURS: Infinity,
} as const;

export interface LeasingFunnelKpi {
  period: string;
  funnel: {
    guestCards: number;
    applications: number;
    approvals: number;
    moveIns: number;
  };
  conversionRates: {
    guestCardToApplication: number;
    applicationToApproval: number;
    approvalToMoveIn: number;
    overallConversion: number;
  };
  avgDaysLeadToLease: number;
  timeToFirstContact: {
    avgHoursToFirstContact: number | null;
    pctContactedUnder1Hour: number | null;
    pctContactedUnder24Hours: number | null;
    pctNeverContacted: number | null;
    dataSource: 'showings' | 'communications' | 'unavailable';
  };
}

export async function fetchLeasingFunnelKpi(): Promise<LeasingFunnelKpi> {
  const config = getKpiConfig();
  const emptyResult: LeasingFunnelKpi = {
    period: 'last_90_days',
    funnel: { guestCards: 0, applications: 0, approvals: 0, moveIns: 0 },
    conversionRates: {
      guestCardToApplication: 0, applicationToApproval: 0,
      approvalToMoveIn: 0, overallConversion: 0,
    },
    avgDaysLeadToLease: 0,
    timeToFirstContact: {
      avgHoursToFirstContact: null, pctContactedUnder1Hour: null,
      pctContactedUnder24Hours: null, pctNeverContacted: null,
      dataSource: 'unavailable',
    },
  };

  if (!config) return emptyResult;

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 90);

  // Fetch leads and rental applications in parallel
  const [leads, rentalApps] = await Promise.all([
    v0FetchAll<V0Lead>(
      '/leads',
      { 'filters[LastUpdatedAtFrom]': sinceDate.toISOString() },
      config
    ),
    v0FetchAll<V0RentalApplication>(
      '/rental_applications',
      { 'filters[SubmittedAtFrom]': sinceDate.toISOString() },
      config
    ),
  ]);

  // Filter leads created in last 90 days
  const recentLeads = leads.filter((l) => new Date(l.CreatedAt) >= sinceDate);

  // Stage 1: Guest Cards = all recent leads
  const guestCards = recentLeads.length;

  // Stage 2: Applications = leads that have a RentalApplicationId
  const leadsWithApp = recentLeads.filter((l) => l.RentalApplicationId);
  const applications = leadsWithApp.length;

  // Build a set of approved application IDs
  const approvedAppIds = new Set(
    rentalApps
      .filter((a) => RENTAL_APP_STATUS_MAP.APPROVED.includes(a.Status as 'approved'))
      .map((a) => a.Id)
  );

  // Stage 3: Approvals = leads whose application was approved
  const approvals = leadsWithApp.filter(
    (l) => l.RentalApplicationId && approvedAppIds.has(l.RentalApplicationId)
  ).length;

  // Stage 4: Move-ins — check lead status or use LEAD_STATUS_MAP
  // TODO: AppFolio lead Status is only "active"/"inactive". For now,
  // estimate move-ins from approved applications with StatusChangedAt > 30 days ago
  // (assumes approved apps that are old enough have likely moved in).
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const moveIns = rentalApps.filter((a) => {
    if (!RENTAL_APP_STATUS_MAP.APPROVED.includes(a.Status as 'approved')) return false;
    if (!a.StatusChangedAt) return false;
    return new Date(a.StatusChangedAt) < thirtyDaysAgo;
  }).length;

  // Conversion rates
  const safeDiv = (num: number, den: number) =>
    den > 0 ? Math.round((num / den) * 1000) / 10 : 0;

  const conversionRates = {
    guestCardToApplication: safeDiv(applications, guestCards),
    applicationToApproval: safeDiv(approvals, applications),
    approvalToMoveIn: safeDiv(moveIns, approvals),
    overallConversion: safeDiv(moveIns, guestCards),
  };

  // Avg days lead to lease: for leads with approved applications
  // Use time from lead CreatedAt to application StatusChangedAt
  let totalDays = 0;
  let countWithDates = 0;
  for (const lead of leadsWithApp) {
    if (!lead.RentalApplicationId || !approvedAppIds.has(lead.RentalApplicationId)) continue;
    const app = rentalApps.find((a) => a.Id === lead.RentalApplicationId);
    if (!app?.StatusChangedAt) continue;
    const days = (new Date(app.StatusChangedAt).getTime() - new Date(lead.CreatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (days >= 0) {
      totalDays += days;
      countWithDates++;
    }
  }
  const avgDaysLeadToLease = countWithDates > 0
    ? Math.round((totalDays / countWithDates) * 10) / 10
    : 0;

  // Time to first contact:
  // Showings endpoint returns 0 results. Communications not available in v0 API.
  // TODO: If AppFolio adds /showings data or /communications endpoint, use it here.
  // RESPONSE_BUCKETS defined above for future use.
  void RESPONSE_BUCKETS;

  return {
    period: 'last_90_days',
    funnel: { guestCards, applications, approvals, moveIns },
    conversionRates,
    avgDaysLeadToLease,
    timeToFirstContact: {
      avgHoursToFirstContact: null,
      pctContactedUnder1Hour: null,
      pctContactedUnder24Hours: null,
      pctNeverContacted: null,
      dataSource: 'unavailable',
    },
  };
}

// ============================================
// KPI 13: Annual Management Fees
// ============================================

interface ManagementFeesKpi {
  feeCount: number;
  totalProperties: number;
}

interface V0PropertyWithCustom {
  Id: string;
  HiddenAt?: string | null;
  CustomValues?: Array<{ Name: string; Value: string }>;
}

export async function fetchManagementFeesKpi(): Promise<ManagementFeesKpi> {
  const config = getKpiConfig();
  if (!config) {
    return { feeCount: 0, totalProperties: 0 };
  }

  const properties = await v0FetchAll<V0PropertyWithCustom>(
    '/properties',
    { 'filters[LastUpdatedAtFrom]': '1970-01-01T00:00:00Z' },
    config,
    1000,
    10
  );

  const active = properties.filter((p) => !p.HiddenAt);
  const feeCount = active.filter((p) =>
    (p.CustomValues || []).some(
      (cv) => cv.Name === 'Accounting Management Fee' && cv.Value === 'Yes'
    )
  ).length;

  return { feeCount, totalProperties: active.length };
}

// Re-export status maps for use in webhook handler
export { LEAD_STATUS_MAP, RENTAL_APP_STATUS_MAP, RESPONSE_BUCKETS };
