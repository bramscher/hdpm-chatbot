/**
 * Diagnostic script to investigate RAG retrieval quality issues
 * 
 * This script tests:
 * - Similarity scores of retrieved chunks
 * - Query expansion effectiveness
 * - Different threshold values
 * - Chunk content and relevance
 * 
 * Usage:
 *   node scripts/diagnose-retrieval.mjs "your query here"
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Query expansion mappings (from lib/rag.ts)
const QUERY_EXPANSIONS = {
  'emotional support animal': ['assistance animal', 'service animal', 'pet', 'animal accommodation'],
  'esa': ['assistance animal', 'service animal', 'emotional support animal'],
  'support animal': ['assistance animal', 'service animal', 'pet'],
  'service dog': ['service animal', 'assistance animal'],
  'therapy animal': ['assistance animal', 'service animal'],
  'deposit': ['security deposit', 'prepaid rent', 'last month rent'],
  'move out': ['termination', 'vacate', 'security deposit', 'accounting'],
  'move-out': ['termination', 'vacate', 'security deposit', 'accounting'],
  'eviction': ['termination', 'for cause', 'notice', 'unlawful detainer'],
  'evict': ['terminate', 'termination notice', 'for cause'],
  'kick out': ['terminate', 'termination', 'eviction'],
  'late fee': ['late charge', 'late rent', 'rent payment'],
  'rent increase': ['rent raise', 'increased rent'],
  'raise rent': ['rent increase', 'increased rent'],
  'repair': ['maintenance', 'habitability', 'essential services'],
  'fix': ['repair', 'maintenance', 'habitability'],
  'broken': ['repair', 'maintenance', 'defective'],
  'lease': ['rental agreement', 'tenancy'],
  'month to month': ['periodic tenancy', 'month-to-month'],
  'break lease': ['early termination', 'terminate tenancy'],
};

function expandQuery(query) {
  const lowerQuery = query.toLowerCase();
  const expansions = [];

  for (const [term, relatedTerms] of Object.entries(QUERY_EXPANSIONS)) {
    if (lowerQuery.includes(term)) {
      expansions.push(...relatedTerms);
    }
  }

  if (expansions.length === 0) {
    return query;
  }

  const uniqueExpansions = [...new Set(expansions)];
  return `${query} ${uniqueExpansions.join(' ')}`;
}

async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

async function searchChunks(embedding, threshold, count) {
  const { data, error } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: embedding,
    threshold,
    count,
  });

  if (error) {
    throw new Error(`Search failed: ${error.message}`);
  }

  return data || [];
}

function formatChunk(chunk, index) {
  const contentPreview = chunk.content.substring(0, 200).replace(/\n/g, ' ');
  return `
[${index + 1}] Similarity: ${(chunk.similarity * 100).toFixed(2)}%
   Section: ${chunk.source_section || '(none)'}
   Source: ${chunk.source_title}
   Type: ${chunk.source_type}
   URL: ${chunk.source_url || '(none)'}
   Content: ${contentPreview}...`;
}

async function diagnoseQuery(query) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('RAG RETRIEVAL DIAGNOSTIC');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log(`Query: "${query}"\n`);

  // Test query expansion
  const expandedQuery = expandQuery(query);
  const wasExpanded = expandedQuery !== query;
  
  console.log('Query Expansion:');
  if (wasExpanded) {
    console.log(`  ✅ Expanded to: "${expandedQuery}"`);
  } else {
    console.log('  ⚠️  No expansion applied');
  }
  console.log('');

  // Generate embeddings
  console.log('Generating embeddings...');
  const originalEmbedding = await generateEmbedding(query);
  const expandedEmbedding = wasExpanded ? await generateEmbedding(expandedQuery) : null;
  console.log(`  ✅ Original query embedding: ${originalEmbedding.length} dimensions`);
  if (expandedEmbedding) {
    console.log(`  ✅ Expanded query embedding: ${expandedEmbedding.length} dimensions`);
  }
  console.log('');

  // Test different thresholds
  const thresholds = [0.30, 0.40, 0.50, 0.60, 0.70];
  const testEmbedding = expandedEmbedding || originalEmbedding;
  const testQuery = expandedQuery;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('THRESHOLD COMPARISON');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const threshold of thresholds) {
    console.log(`Threshold: ${threshold}`);
    const chunks = await searchChunks(testEmbedding, threshold, 10);
    
    if (chunks.length === 0) {
      console.log('  ❌ No chunks found\n');
      continue;
    }

    console.log(`  ✅ Found ${chunks.length} chunks`);
    
    // Show similarity score distribution
    const scores = chunks.map(c => c.similarity);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    
    console.log(`  Similarity scores: min=${(minScore * 100).toFixed(2)}%, avg=${(avgScore * 100).toFixed(2)}%, max=${(maxScore * 100).toFixed(2)}%`);
    
    // Show source type distribution
    const sourceTypes = {};
    chunks.forEach(c => {
      sourceTypes[c.source_type] = (sourceTypes[c.source_type] || 0) + 1;
    });
    console.log(`  Source types: ${Object.entries(sourceTypes).map(([t, c]) => `${t}=${c}`).join(', ')}`);
    
    // Show top 3 chunks
    console.log(`  Top 3 chunks:`);
    chunks.slice(0, 3).forEach((chunk, i) => {
      const section = chunk.source_section || '(none)';
      const title = chunk.source_title.substring(0, 50);
      console.log(`    ${i + 1}. [${(chunk.similarity * 100).toFixed(2)}%] ${chunk.source_type} - ${title} - ${section}`);
    });
    console.log('');
  }

  // Detailed analysis with current threshold (0.30)
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('DETAILED ANALYSIS (Threshold: 0.30, Count: 5)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const currentChunks = await searchChunks(testEmbedding, 0.30, 5);
  
  if (currentChunks.length === 0) {
    console.log('❌ No chunks found with threshold 0.30\n');
  } else {
    console.log(`Found ${currentChunks.length} chunks:\n`);
    currentChunks.forEach((chunk, i) => {
      console.log(formatChunk(chunk, i));
    });
  }

  // Compare with and without expansion
  if (wasExpanded) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('EXPANSION COMPARISON');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const originalChunks = await searchChunks(originalEmbedding, 0.30, 5);
    const expandedChunks = await searchChunks(expandedEmbedding, 0.30, 5);

    console.log('Without expansion:');
    console.log(`  Found ${originalChunks.length} chunks`);
    if (originalChunks.length > 0) {
      const avgSim = originalChunks.reduce((sum, c) => sum + c.similarity, 0) / originalChunks.length;
      console.log(`  Average similarity: ${(avgSim * 100).toFixed(2)}%`);
    }

    console.log('\nWith expansion:');
    console.log(`  Found ${expandedChunks.length} chunks`);
    if (expandedChunks.length > 0) {
      const avgSim = expandedChunks.reduce((sum, c) => sum + c.similarity, 0) / expandedChunks.length;
      console.log(`  Average similarity: ${(avgSim * 100).toFixed(2)}%`);
    }

    // Check if results differ
    const originalIds = new Set(originalChunks.map(c => c.id));
    const expandedIds = new Set(expandedChunks.map(c => c.id));
    const overlap = [...originalIds].filter(id => expandedIds.has(id)).length;
    console.log(`\n  Overlap: ${overlap}/${Math.max(originalChunks.length, expandedChunks.length)} chunks are the same`);
  }

  // Database statistics
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('DATABASE STATISTICS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const { count, error: countError } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`Total chunks in database: ${count || 0}`);
  }

  const { data: typeStats, error: typeError } = await supabase
    .from('knowledge_chunks')
    .select('source_type');

  if (!typeError && typeStats) {
    const typeCounts = {};
    typeStats.forEach(row => {
      typeCounts[row.source_type] = (typeCounts[row.source_type] || 0) + 1;
    });
    console.log('\nChunks by source type:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  }

  // Sample ORS 90 sections
  const { data: orsSamples, error: orsError } = await supabase
    .from('knowledge_chunks')
    .select('source_section, source_title')
    .eq('source_type', 'ors_90')
    .limit(20);

  if (!orsError && orsSamples) {
    const uniqueSections = [...new Set(orsSamples.map(s => s.source_section).filter(Boolean))];
    console.log(`\nSample ORS 90 sections in database: ${uniqueSections.slice(0, 10).join(', ')}${uniqueSections.length > 10 ? '...' : ''}`);
    console.log(`Total unique ORS sections found: ${uniqueSections.length}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('DIAGNOSTIC COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

async function main() {
  const query = process.argv[2];

  if (!query) {
    console.error('Usage: node scripts/diagnose-retrieval.mjs "your query here"');
    console.error('\nExample queries:');
    console.error('  node scripts/diagnose-retrieval.mjs "late fees"');
    console.error('  node scripts/diagnose-retrieval.mjs "security deposit return"');
    console.error('  node scripts/diagnose-retrieval.mjs "eviction notice requirements"');
    process.exit(1);
  }

  // Check environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing Supabase environment variables');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: Missing OPENAI_API_KEY environment variable');
    process.exit(1);
  }

  try {
    await diagnoseQuery(query);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
