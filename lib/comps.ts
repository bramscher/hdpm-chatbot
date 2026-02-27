import { getSupabaseAdmin } from './supabase';
import type {
  RentalComp,
  CreateCompInput,
  UpdateCompInput,
  MarketBaseline,
  UpsertBaselineInput,
  CompsFilter,
  CompsStats,
  TownStats,
  Town,
} from '@/types/comps';

// ============================================
// Rental Comps — CRUD
// ============================================

export async function createComp(input: CreateCompInput): Promise<RentalComp> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('rental_comps')
    .insert({
      town: input.town,
      address: input.address || null,
      zip_code: input.zip_code || null,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms ?? 1,
      sqft: input.sqft || null,
      property_type: input.property_type,
      amenities: input.amenities || [],
      monthly_rent: input.monthly_rent,
      rent_per_sqft: input.rent_per_sqft || null,
      data_source: input.data_source || 'manual',
      comp_date: input.comp_date || new Date().toISOString().split('T')[0],
      external_id: input.external_id || null,
      rentometer_percentile: input.rentometer_percentile || null,
      rentometer_cached_until: input.rentometer_cached_until || null,
      notes: input.notes || null,
      created_by: input.created_by,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating comp:', error);
    throw new Error(`Failed to create comp: ${error.message}`);
  }

  return data as RentalComp;
}

export async function getComps(filter?: CompsFilter, limit = 200, offset = 0): Promise<RentalComp[]> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('rental_comps')
    .select('*')
    .order('comp_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter) {
    if (filter.towns && filter.towns.length > 0) {
      query = query.in('town', filter.towns);
    }
    if (filter.bedrooms && filter.bedrooms.length > 0) {
      query = query.in('bedrooms', filter.bedrooms);
    }
    if (filter.property_types && filter.property_types.length > 0) {
      query = query.in('property_type', filter.property_types);
    }
    if (filter.data_sources && filter.data_sources.length > 0) {
      query = query.in('data_source', filter.data_sources);
    }
    if (filter.date_from) {
      query = query.gte('comp_date', filter.date_from);
    }
    if (filter.date_to) {
      query = query.lte('comp_date', filter.date_to);
    }
    if (filter.rent_min !== undefined) {
      query = query.gte('monthly_rent', filter.rent_min);
    }
    if (filter.rent_max !== undefined) {
      query = query.lte('monthly_rent', filter.rent_max);
    }
    if (filter.sqft_min !== undefined) {
      query = query.gte('sqft', filter.sqft_min);
    }
    if (filter.sqft_max !== undefined) {
      query = query.lte('sqft', filter.sqft_max);
    }
    // Amenities filter: use contains (&&) for array overlap
    if (filter.amenities && filter.amenities.length > 0) {
      query = query.contains('amenities', filter.amenities);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching comps:', error);
    throw new Error(`Failed to fetch comps: ${error.message}`);
  }

  return data as RentalComp[];
}

export async function getCompById(id: string): Promise<RentalComp | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('rental_comps')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching comp:', error);
    throw new Error(`Failed to fetch comp: ${error.message}`);
  }

  return data as RentalComp;
}

export async function updateComp(id: string, input: UpdateCompInput): Promise<RentalComp> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('rental_comps')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating comp:', error);
    throw new Error(`Failed to update comp: ${error.message}`);
  }

  return data as RentalComp;
}

export async function deleteComp(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('rental_comps')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting comp:', error);
    throw new Error(`Failed to delete comp: ${error.message}`);
  }
}

export async function bulkUpsertComps(comps: CreateCompInput[]): Promise<number> {
  const supabase = getSupabaseAdmin();

  // Separate comps with external_id (sync sources) from manual entries
  const withExternalId = comps.filter((c) => c.external_id);
  const withoutExternalId = comps.filter((c) => !c.external_id);

  let totalUpserted = 0;

  // For comps with external_id: delete existing matches, then insert fresh
  if (withExternalId.length > 0) {
    const externalIds = withExternalId.map((c) => c.external_id!);

    // Delete existing rows that will be replaced
    const { error: deleteError } = await supabase
      .from('rental_comps')
      .delete()
      .in('external_id', externalIds);

    if (deleteError) {
      console.error('Error deleting existing comps for upsert:', deleteError);
      // Non-fatal — continue with insert (some may be new)
    }

    // Insert all rows
    const rows = withExternalId.map((c) => ({
      town: c.town,
      address: c.address || null,
      zip_code: c.zip_code || null,
      bedrooms: c.bedrooms,
      bathrooms: c.bathrooms ?? 1,
      sqft: c.sqft || null,
      property_type: c.property_type,
      amenities: c.amenities || [],
      monthly_rent: c.monthly_rent,
      rent_per_sqft: c.rent_per_sqft || null,
      data_source: c.data_source || 'manual',
      comp_date: c.comp_date || new Date().toISOString().split('T')[0],
      external_id: c.external_id,
      rentometer_percentile: c.rentometer_percentile || null,
      rentometer_cached_until: c.rentometer_cached_until || null,
      notes: c.notes || null,
      created_by: c.created_by,
    }));

    const { data, error } = await supabase
      .from('rental_comps')
      .insert(rows)
      .select();

    if (error) {
      console.error('Error inserting synced comps:', error);
      throw new Error(`Failed to bulk upsert comps: ${error.message}`);
    }

    totalUpserted += data?.length || 0;
  }

  // For comps without external_id: just insert
  if (withoutExternalId.length > 0) {
    const rows = withoutExternalId.map((c) => ({
      town: c.town,
      address: c.address || null,
      zip_code: c.zip_code || null,
      bedrooms: c.bedrooms,
      bathrooms: c.bathrooms ?? 1,
      sqft: c.sqft || null,
      property_type: c.property_type,
      amenities: c.amenities || [],
      monthly_rent: c.monthly_rent,
      rent_per_sqft: c.rent_per_sqft || null,
      data_source: c.data_source || 'manual',
      comp_date: c.comp_date || new Date().toISOString().split('T')[0],
      external_id: null,
      rentometer_percentile: c.rentometer_percentile || null,
      rentometer_cached_until: c.rentometer_cached_until || null,
      notes: c.notes || null,
      created_by: c.created_by,
    }));

    const { data, error } = await supabase
      .from('rental_comps')
      .insert(rows)
      .select();

    if (error) {
      console.error('Error inserting manual comps:', error);
      throw new Error(`Failed to insert comps: ${error.message}`);
    }

    totalUpserted += data?.length || 0;
  }

  return totalUpserted;
}

// ============================================
// Stats Computation
// ============================================

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function getCompsStats(filter?: CompsFilter): Promise<CompsStats> {
  const comps = await getComps(filter, 1000);

  if (comps.length === 0) {
    return {
      count: 0,
      avg_rent: 0,
      median_rent: 0,
      min_rent: 0,
      max_rent: 0,
      avg_sqft: null,
      avg_rent_per_sqft: null,
    };
  }

  const rents = comps.map((c) => Number(c.monthly_rent));
  const sqfts = comps.filter((c) => c.sqft).map((c) => Number(c.sqft));
  const rentPerSqfts = comps
    .filter((c) => c.rent_per_sqft)
    .map((c) => Number(c.rent_per_sqft));

  return {
    count: comps.length,
    avg_rent: Math.round(rents.reduce((a, b) => a + b, 0) / rents.length),
    median_rent: Math.round(median(rents)),
    min_rent: Math.min(...rents),
    max_rent: Math.max(...rents),
    avg_sqft: sqfts.length > 0
      ? Math.round(sqfts.reduce((a, b) => a + b, 0) / sqfts.length)
      : null,
    avg_rent_per_sqft: rentPerSqfts.length > 0
      ? Math.round((rentPerSqfts.reduce((a, b) => a + b, 0) / rentPerSqfts.length) * 100) / 100
      : null,
  };
}

export async function getCompsByTown(filter?: CompsFilter): Promise<TownStats[]> {
  const comps = await getComps(filter, 1000);

  const townMap = new Map<Town, number[]>();
  for (const comp of comps) {
    const town = comp.town as Town;
    if (!townMap.has(town)) townMap.set(town, []);
    townMap.get(town)!.push(Number(comp.monthly_rent));
  }

  const results: TownStats[] = [];
  for (const [town, rents] of townMap) {
    results.push({
      town,
      count: rents.length,
      avg_rent: Math.round(rents.reduce((a, b) => a + b, 0) / rents.length),
      median_rent: Math.round(median(rents)),
      min_rent: Math.min(...rents),
      max_rent: Math.max(...rents),
    });
  }

  // Sort by town name for consistent chart ordering
  results.sort((a, b) => a.town.localeCompare(b.town));
  return results;
}

// ============================================
// Market Baselines — CRUD
// ============================================

export async function getBaselines(
  county?: string,
  dataYear?: number
): Promise<MarketBaseline[]> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('market_baselines')
    .select('*')
    .order('area_name')
    .order('bedrooms');

  if (county) {
    query = query.eq('county', county);
  }
  if (dataYear) {
    query = query.eq('data_year', dataYear);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching baselines:', error);
    throw new Error(`Failed to fetch baselines: ${error.message}`);
  }

  return data as MarketBaseline[];
}

export async function upsertBaseline(input: UpsertBaselineInput): Promise<MarketBaseline> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('market_baselines')
    .upsert(
      {
        area_name: input.area_name,
        county: input.county,
        bedrooms: input.bedrooms,
        fmr_rent: input.fmr_rent || null,
        median_rent: input.median_rent || null,
        data_year: input.data_year,
        source: input.source || 'hud_fmr',
      },
      { onConflict: 'area_name,bedrooms,data_year' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error upserting baseline:', error);
    throw new Error(`Failed to upsert baseline: ${error.message}`);
  }

  return data as MarketBaseline;
}

export async function bulkUpsertBaselines(baselines: UpsertBaselineInput[]): Promise<number> {
  const supabase = getSupabaseAdmin();

  const rows = baselines.map((b) => ({
    area_name: b.area_name,
    county: b.county,
    bedrooms: b.bedrooms,
    fmr_rent: b.fmr_rent || null,
    median_rent: b.median_rent || null,
    data_year: b.data_year,
    source: b.source || 'hud_fmr',
  }));

  const { data, error } = await supabase
    .from('market_baselines')
    .upsert(rows, { onConflict: 'area_name,bedrooms,data_year' })
    .select();

  if (error) {
    console.error('Error bulk upserting baselines:', error);
    throw new Error(`Failed to bulk upsert baselines: ${error.message}`);
  }

  return data?.length || 0;
}
