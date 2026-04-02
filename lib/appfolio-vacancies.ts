const APPFOLIO_V0_BASE = 'https://api.appfolio.com/api/v0';

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
  Address1?: string;
  Address2?: string | null;
  City?: string;
  State?: string;
  Zip?: string;
  Status?: string;
  Name?: string;
}

interface V0Property {
  Id: string;
  Name?: string;
  Address1?: string;
  Address2?: string;
  City?: string;
  State?: string;
  Zip?: string;
  PropertyType?: string;
  HiddenAt?: string | null;
}

interface V0ListResponse<T> {
  data: T[];
  next_page_path?: string | null;
}

export interface VacantUnit {
  appfolio_unit_id: string;
  appfolio_property_id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  bedrooms: number;
  bathrooms: number;
  rent: number;
  sqft: number;
  available_date: string;
  unit_type: string;
  amenities: string[];
}

function parseNumber(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(/[^0-9.-]/g, ''));
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function mapUnitType(propertyType: string): string {
  const t = (propertyType || '').toLowerCase();
  if (t.includes('single') || t.includes('house') || t.includes('sfr')) return 'House';
  if (t.includes('apartment') || t.includes('apt')) return 'Apartment';
  if (t.includes('townhouse') || t.includes('townhome')) return 'Townhouse';
  if (t.includes('duplex')) return 'Duplex';
  if (t.includes('condo')) return 'Condo';
  if (t.includes('manufactured') || t.includes('mobile')) return 'Manufactured';
  if (t.includes('multi')) return 'Multi-Family';
  return propertyType || 'Rental';
}

async function v0Fetch<T>(
  path: string,
  params: Record<string, string>,
  auth: string,
  developerId: string
): Promise<V0ListResponse<T>> {
  const url = new URL(`${APPFOLIO_V0_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

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
    throw new Error(`AppFolio API error (${response.status}): ${text.substring(0, 300)}`);
  }

  return JSON.parse(text) as V0ListResponse<T>;
}

/**
 * Fetch all vacant units directly from the AppFolio v0 API.
 * This is the core logic — no HTTP/auth dependencies.
 */
export async function fetchVacantUnits(): Promise<VacantUnit[]> {
  const clientId = process.env.APPFOLIO_CLIENT_ID;
  const clientSecret = process.env.APPFOLIO_CLIENT_SECRET;
  const developerId = process.env.APPFOLIO_DEVELOPER_ID;

  if (!clientId || !clientSecret || !developerId) {
    throw new Error('AppFolio API credentials not configured');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  // Fetch all properties (paginated)
  const allProperties: V0Property[] = [];
  let pageNumber = 1;
  while (true) {
    const res = await v0Fetch<V0Property>(
      '/properties',
      {
        'filters[LastUpdatedAtFrom]': '1970-01-01T00:00:00Z',
        'page[number]': String(pageNumber),
        'page[size]': '1000',
      },
      auth,
      developerId
    );
    allProperties.push(...(res.data || []));
    if ((res.data || []).length < 1000 || !res.next_page_path) break;
    pageNumber++;
    if (pageNumber > 10) break;
  }

  // Build property lookup map (exclude hidden)
  const propertyMap = new Map<string, V0Property>();
  for (const p of allProperties) {
    if (!p.HiddenAt) propertyMap.set(p.Id, p);
  }

  // Fetch all units (paginated)
  const allUnits: V0Unit[] = [];
  pageNumber = 1;
  while (true) {
    const res = await v0Fetch<V0Unit>(
      '/units',
      {
        'filters[LastUpdatedAtFrom]': '2000-01-01T00:00:00Z',
        'page[number]': String(pageNumber),
        'page[size]': '200',
      },
      auth,
      developerId
    );
    allUnits.push(...(res.data || []));
    if ((res.data || []).length < 200 || !res.next_page_path) break;
    pageNumber++;
    if (pageNumber > 50) break;
  }

  // Filter to vacant/available units
  const vacantUnits: VacantUnit[] = [];

  for (const unit of allUnits) {
    const status = (unit.Status || '').toLowerCase();
    const isVacant = status.includes('vacant') || status.includes('available');
    if (!isVacant) continue;

    const property = unit.PropertyId ? propertyMap.get(unit.PropertyId) : null;

    const address = unit.Address1
      || (property ? [property.Address1, property.Address2].filter(Boolean).join(', ') : '');
    const city = unit.City || property?.City || '';
    const state = unit.State || property?.State || 'OR';
    const zip = unit.Zip || property?.Zip || '';

    const unitSuffix = unit.Name && unit.Name !== address ? ` ${unit.Name}` : '';
    const fullAddress = `${address}${unitSuffix}`.trim();

    const rent = parseNumber(unit.ListedRent) || parseNumber(unit.MarketRent);
    if (!rent || rent <= 0) continue;

    vacantUnits.push({
      appfolio_unit_id: unit.Id,
      appfolio_property_id: unit.PropertyId || '',
      address: fullAddress,
      city,
      state,
      zip,
      bedrooms: Math.round(parseNumber(unit.Bedrooms)),
      bathrooms: parseNumber(unit.Bathrooms),
      rent,
      sqft: Math.round(parseNumber(unit.SquareFeet)),
      available_date: unit.AvailableOn || '',
      unit_type: mapUnitType(property?.PropertyType || ''),
      amenities: unit.AppliancesIncluded || [],
    });
  }

  vacantUnits.sort((a, b) => a.city.localeCompare(b.city) || a.address.localeCompare(b.address));

  return vacantUnits;
}
