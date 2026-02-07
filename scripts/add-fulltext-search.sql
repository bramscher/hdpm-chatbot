-- ============================================
-- Migration: Add Full-Text Search to knowledge_chunks
-- Run this in the Supabase SQL Editor
-- ============================================

-- Step 1: Add a tsvector column for full-text search
ALTER TABLE knowledge_chunks
ADD COLUMN IF NOT EXISTS fts tsvector
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Step 2: Create a GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS knowledge_chunks_fts_idx
ON knowledge_chunks USING GIN (fts);

-- Step 3: Create the full-text search RPC function
-- This searches by keyword/phrase and returns results ranked by relevance
CREATE OR REPLACE FUNCTION search_knowledge_fulltext(
  search_query text,
  max_results int DEFAULT 15
)
RETURNS TABLE (
  id uuid,
  content text,
  source_type text,
  source_title text,
  source_url text,
  source_section text,
  rank real
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kc.source_type,
    kc.source_title,
    kc.source_url,
    kc.source_section,
    ts_rank(kc.fts, websearch_to_tsquery('english', search_query)) AS rank
  FROM knowledge_chunks kc
  WHERE kc.fts @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$;

-- Step 4: Create a phrase search variant for exact phrase matching
-- Use this when the user puts something in quotes or asks "which section says..."
CREATE OR REPLACE FUNCTION search_knowledge_phrase(
  search_phrase text,
  max_results int DEFAULT 15
)
RETURNS TABLE (
  id uuid,
  content text,
  source_type text,
  source_title text,
  source_url text,
  source_section text,
  rank real
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kc.source_type,
    kc.source_title,
    kc.source_url,
    kc.source_section,
    ts_rank(kc.fts, phraseto_tsquery('english', search_phrase)) AS rank
  FROM knowledge_chunks kc
  WHERE kc.fts @@ phraseto_tsquery('english', search_phrase)
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$;

-- Step 5: Create a simple ILIKE search for exact substring matching
-- Fallback for when tsquery parsing strips important terms
CREATE OR REPLACE FUNCTION search_knowledge_substring(
  search_text text,
  max_results int DEFAULT 15
)
RETURNS TABLE (
  id uuid,
  content text,
  source_type text,
  source_title text,
  source_url text,
  source_section text,
  rank real
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kc.source_type,
    kc.source_title,
    kc.source_url,
    kc.source_section,
    1.0::real AS rank
  FROM knowledge_chunks kc
  WHERE kc.content ILIKE '%' || search_text || '%'
  ORDER BY kc.source_section ASC NULLS LAST
  LIMIT max_results;
END;
$$;

-- ============================================
-- Verification: Run these after the migration
-- ============================================

-- Check that the fts column was created:
-- SELECT id, source_section, left(content, 80), fts IS NOT NULL as has_fts
-- FROM knowledge_chunks LIMIT 5;

-- Test full-text search:
-- SELECT source_section, rank, left(content, 100)
-- FROM search_knowledge_fulltext('late fee', 5);

-- Test phrase search:
-- SELECT source_section, rank, left(content, 100)
-- FROM search_knowledge_phrase('reasonable wear and tear', 5);

-- Test substring search:
-- SELECT source_section, rank, left(content, 100)
-- FROM search_knowledge_substring('90.300', 5);
