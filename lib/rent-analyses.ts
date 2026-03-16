/**
 * Saved Rent Analyses — CRUD operations
 */

import { getSupabaseAdmin } from './supabase';
import type { RentAnalysis, SavedRentAnalysis } from '@/types/comps';

export interface SaveAnalysisInput {
  analysis: RentAnalysis;
  recommended_rent_override?: number | null;
  prepared_for?: string | null;
  owner_email?: string | null;
  manager_notes?: string | null;
  pdf_file_path?: string | null;
  short_url?: string | null;
  created_by: string;
}

export async function saveRentAnalysis(input: SaveAnalysisInput): Promise<SavedRentAnalysis> {
  const supabase = getSupabaseAdmin();
  const { analysis } = input;

  const { data, error } = await supabase
    .from('rent_analyses')
    .insert({
      address: analysis.subject.address,
      town: analysis.subject.town,
      bedrooms: analysis.subject.bedrooms,
      bathrooms: analysis.subject.bathrooms ?? null,
      sqft: analysis.subject.sqft ?? null,
      property_type: analysis.subject.property_type,
      recommended_rent_low: analysis.recommended_rent_low,
      recommended_rent_mid: analysis.recommended_rent_mid,
      recommended_rent_high: analysis.recommended_rent_high,
      recommended_rent_override: input.recommended_rent_override ?? null,
      prepared_for: input.prepared_for ?? null,
      owner_email: input.owner_email ?? null,
      manager_notes: input.manager_notes ?? null,
      analysis_json: analysis,
      pdf_file_path: input.pdf_file_path ?? null,
      short_url: input.short_url ?? null,
      created_by: input.created_by,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving rent analysis:', error);
    throw new Error(`Failed to save rent analysis: ${error.message}`);
  }

  return data as SavedRentAnalysis;
}

export async function listRentAnalyses(limit = 50): Promise<SavedRentAnalysis[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('rent_analyses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error listing rent analyses:', error);
    throw new Error(`Failed to list rent analyses: ${error.message}`);
  }

  return data as SavedRentAnalysis[];
}

export async function getRentAnalysis(id: string): Promise<SavedRentAnalysis | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('rent_analyses')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching rent analysis:', error);
    throw new Error(`Failed to fetch rent analysis: ${error.message}`);
  }

  return data as SavedRentAnalysis;
}

export async function updateRentAnalysis(
  id: string,
  updates: {
    recommended_rent_override?: number | null;
    prepared_for?: string | null;
    owner_email?: string | null;
    manager_notes?: string | null;
    analysis_json?: RentAnalysis;
    pdf_file_path?: string | null;
    short_url?: string | null;
  }
): Promise<SavedRentAnalysis> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('rent_analyses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating rent analysis:', error);
    throw new Error(`Failed to update rent analysis: ${error.message}`);
  }

  return data as SavedRentAnalysis;
}

export async function deleteRentAnalysis(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('rent_analyses')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting rent analysis:', error);
    throw new Error(`Failed to delete rent analysis: ${error.message}`);
  }
}
