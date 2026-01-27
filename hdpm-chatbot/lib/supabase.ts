import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types for our knowledge base
export interface KnowledgeChunk {
  id: string;
  content: string;
  source_type: 'ors_90' | 'loom_video' | 'policy_doc';
  source_title: string;
  source_url: string;
  source_section: string | null;
  similarity?: number;
}

// Lazy initialization to avoid build-time errors
let _supabaseClient: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

// Client-side Supabase client (uses publishable key)
export function getSupabaseClient(): SupabaseClient {
  if (!_supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    if (!url || !publishableKey) {
      throw new Error('Missing Supabase environment variables');
    }

    _supabaseClient = createClient(url, publishableKey);
  }
  return _supabaseClient;
}

// Server-side Supabase client (uses service role key for RPC calls)
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    _supabaseAdmin = createClient(url, serviceKey);
  }
  return _supabaseAdmin;
}

// Function to search knowledge chunks using pgvector
export async function searchKnowledgeChunks(
  queryEmbedding: number[],
  threshold: number = 0.7,
  count: number = 5
): Promise<KnowledgeChunk[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: queryEmbedding,
    threshold,
    count,
  });

  if (error) {
    console.error('Error searching knowledge chunks:', error);
    throw new Error(`Failed to search knowledge base: ${error.message}`);
  }

  return data as KnowledgeChunk[];
}
