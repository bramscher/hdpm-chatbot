import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchVacantUnits, type VacantUnit } from '@/lib/appfolio-vacancies';

// GET — return cached vacancies (instant load)
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('cached_vacancies')
      .select('*')
      .order('city', { ascending: true })
      .order('address', { ascending: true });

    // Table doesn't exist yet — return empty (user needs to run migration)
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return NextResponse.json({ units: [], cached: true, needsMigration: true });
    }
    if (error) throw new Error(error.message);

    return NextResponse.json({ units: data || [], cached: true });
  } catch (err) {
    console.error('[cached-vacancies] GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load cached vacancies' },
      { status: 500 }
    );
  }
}

// POST — sync: pull fresh from AppFolio, upsert new/updated, remove stale
export async function POST() {
  try {
    // 1. Pull fresh vacancies directly from AppFolio API
    const freshUnits: VacantUnit[] = await fetchVacantUnits();
    const freshIds = new Set(freshUnits.map((u) => u.appfolio_unit_id));
    const now = new Date().toISOString();

    const supabase = getSupabaseAdmin();

    // 2. Upsert all fresh units
    if (freshUnits.length > 0) {
      const rows = freshUnits.map((u) => ({
        appfolio_unit_id: u.appfolio_unit_id,
        appfolio_property_id: u.appfolio_property_id || '',
        address: u.address,
        city: u.city,
        state: u.state,
        zip: u.zip,
        bedrooms: u.bedrooms,
        bathrooms: u.bathrooms,
        rent: u.rent,
        sqft: u.sqft,
        available_date: u.available_date || '',
        unit_type: u.unit_type || 'Rental',
        amenities: u.amenities || [],
        last_synced_at: now,
      }));

      const { error: upsertError } = await supabase
        .from('cached_vacancies')
        .upsert(rows, { onConflict: 'appfolio_unit_id' });

      if (upsertError) throw new Error(`Upsert failed: ${upsertError.message}`);
    }

    // 3. Remove units that are no longer vacant
    const { data: existing } = await supabase
      .from('cached_vacancies')
      .select('appfolio_unit_id');

    const staleIds = (existing || [])
      .map((r) => r.appfolio_unit_id)
      .filter((id: string) => !freshIds.has(id));

    if (staleIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('cached_vacancies')
        .delete()
        .in('appfolio_unit_id', staleIds);

      if (deleteError) console.error('[cached-vacancies] Delete stale error:', deleteError);
    }

    // 4. Return the fresh list
    return NextResponse.json({
      units: freshUnits,
      cached: false,
      synced: {
        total: freshUnits.length,
        removed: staleIds.length,
      },
    });
  } catch (err) {
    console.error('[cached-vacancies] POST sync error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
