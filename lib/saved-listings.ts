/**
 * Saved Craigslist Listings — CRUD operations
 */

import { getSupabaseAdmin } from './supabase';

export interface SavedListing {
  id: string;
  appfolio_unit_id: string;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  bedrooms: number;
  bathrooms: number | null;
  sqft: number | null;
  monthly_rent: number;
  unit_type: string | null;
  amenities: string[] | null;
  available_date: string | null;
  listing_title: string;
  listing_body: string;
  rently_enabled: boolean;
  rently_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SaveListingInput {
  appfolio_unit_id: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  bedrooms: number;
  bathrooms?: number;
  sqft?: number;
  monthly_rent: number;
  unit_type?: string;
  amenities?: string[];
  available_date?: string;
  listing_title: string;
  listing_body: string;
  rently_enabled: boolean;
  rently_url?: string;
  created_by: string;
}

export async function saveListing(input: SaveListingInput): Promise<SavedListing> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('saved_listings')
    .insert({
      appfolio_unit_id: input.appfolio_unit_id,
      address: input.address,
      city: input.city,
      state: input.state,
      zip: input.zip ?? null,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms ?? null,
      sqft: input.sqft ?? null,
      monthly_rent: input.monthly_rent,
      unit_type: input.unit_type ?? null,
      amenities: input.amenities ?? null,
      available_date: input.available_date ?? null,
      listing_title: input.listing_title,
      listing_body: input.listing_body,
      rently_enabled: input.rently_enabled,
      rently_url: input.rently_url ?? null,
      created_by: input.created_by,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving listing:', error);
    throw new Error(`Failed to save listing: ${error.message}`);
  }

  return data as SavedListing;
}

export async function listSavedListings(limit = 50): Promise<SavedListing[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('saved_listings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error listing saved listings:', error);
    throw new Error(`Failed to list saved listings: ${error.message}`);
  }

  return data as SavedListing[];
}

export async function getSavedListing(id: string): Promise<SavedListing | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('saved_listings')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching saved listing:', error);
    throw new Error(`Failed to fetch saved listing: ${error.message}`);
  }

  return data as SavedListing;
}

export async function deleteSavedListing(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('saved_listings')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting saved listing:', error);
    throw new Error(`Failed to delete saved listing: ${error.message}`);
  }
}
