/**
 * Fetch and Ingest Complete Oregon ORS Chapter 90
 *
 * This script fetches ALL ORS 90 sections from oregon.public.law
 * and ingests them into the knowledge base with accurate content.
 *
 * Usage:
 *   node scripts/fetch-ors90-complete.mjs [startIndex] [batchSize]
 *
 * Examples:
 *   node scripts/fetch-ors90-complete.mjs 0 10    # Process first 10 sections
 *   node scripts/fetch-ors90-complete.mjs 10 10   # Process sections 11-20
 *   node scripts/fetch-ors90-complete.mjs 0 200   # Process all sections
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

// Complete list of all ORS Chapter 90 sections from official sources
const ALL_ORS_90_SECTIONS = [
  // General Provisions (90.100-90.160)
  "90.100", "90.105", "90.110", "90.112", "90.113", "90.115", "90.120",
  "90.125", "90.130", "90.135", "90.140", "90.145", "90.147", "90.148",
  "90.150", "90.155", "90.160",

  // Content of Rental Agreements (90.220-90.275)
  "90.220", "90.222", "90.228", "90.230", "90.243", "90.245", "90.250",
  "90.255", "90.260", "90.262", "90.263", "90.265", "90.275",

  // Fees and Deposits (90.295-90.302)
  "90.295", "90.297", "90.300", "90.302",

  // Landlord Rights and Obligations (90.303-90.324)
  "90.303", "90.304", "90.305", "90.306", "90.308", "90.310", "90.315",
  "90.316", "90.317", "90.318", "90.320", "90.321", "90.322", "90.323", "90.324",

  // Tenant Obligations (90.325-90.340)
  "90.325", "90.340",

  // Tenant Rights and Remedies (90.355-90.390)
  "90.355", "90.358", "90.360", "90.365", "90.367", "90.368", "90.370",
  "90.372", "90.375", "90.380", "90.385", "90.388", "90.390",

  // Landlord Remedies (90.391-90.440)
  "90.391", "90.392", "90.394", "90.395", "90.396", "90.398", "90.401",
  "90.403", "90.405", "90.410", "90.412", "90.414", "90.417", "90.420",
  "90.425", "90.427", "90.429", "90.430", "90.435", "90.440",

  // Domestic Violence, Sexual Assault, Bias Crime or Stalking (90.445-90.459)
  "90.445", "90.449", "90.453", "90.456", "90.459",

  // Miscellaneous (90.460-90.493)
  "90.460", "90.462", "90.465", "90.472", "90.475", "90.485", "90.490", "90.493",

  // Manufactured Dwelling Parks and Marinas - General Provisions (90.505-90.555)
  "90.505", "90.510", "90.512", "90.514", "90.516", "90.518", "90.525",
  "90.527", "90.528", "90.530", "90.545", "90.550", "90.555",

  // Utility and Service Charges (90.560-90.584)
  "90.560", "90.562", "90.564", "90.566", "90.568", "90.570", "90.572",
  "90.574", "90.576", "90.578", "90.580", "90.582", "90.584",

  // Landlord and Tenant Relations (90.600-90.640)
  "90.600", "90.605", "90.610", "90.620", "90.630", "90.632", "90.634", "90.640",

  // Conversion or Closure of Facilities (90.643-90.671)
  "90.643", "90.645", "90.650", "90.655", "90.660", "90.671",

  // Ownership Change (90.675-90.680)
  "90.675", "90.680",

  // Actions (90.710-90.720)
  "90.710", "90.720",

  // Landlord Rights and Obligations - Continued (90.725-90.738)
  "90.725", "90.727", "90.729", "90.730", "90.732", "90.734", "90.736", "90.738",

  // Tenant Rights and Obligations - Continued (90.740-90.765)
  "90.740", "90.750", "90.755", "90.765",

  // Dispute Resolution (90.767-90.775)
  "90.767", "90.769", "90.771", "90.775",

  // Facility Purchase (90.800-90.850)
  "90.800", "90.840", "90.842", "90.844", "90.846", "90.848", "90.849", "90.850",

  // Dealer Sales of Manufactured Dwellings (90.860-90.875)
  "90.860", "90.865", "90.870", "90.875"
];

/**
 * Fetch section content from oregon.public.law
 */
async function fetchSectionContent(sectionNumber) {
  const url = `https://oregon.public.law/statutes/ors_${sectionNumber}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Extract title - look for the name span or title tag
    const nameMatch = html.match(/<span[^>]*id=['"]name['"][^>]*>([\s\S]*?)<\/span>/i);
    const titleTagMatch = html.match(/<title>ORS\s*[\d.]+\s*[-–—]\s*([^<]+)<\/title>/i);
    let title = nameMatch ? nameMatch[1].trim() :
                titleTagMatch ? titleTagMatch[1].trim() :
                `Section ${sectionNumber}`;
    title = title.replace(/<[^>]+>/g, '').trim();

    // Extract article content (main statute text)
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);

    if (!articleMatch) {
      return { title, content: '', url };
    }

    // Clean up the content
    let content = articleMatch[1]
      // Remove script, style, nav, aside, footer, header tags and their content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      // Remove "Text Annotations" section and everything after
      .replace(/Text\s+Annotations[\s\S]*/gi, '')
      // Remove "Notes of Decisions" section
      .replace(/Notes\s+of\s+Decisions[\s\S]*/gi, '')
      // Remove all remaining HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&lsquo;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#\d+;/g, '')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();

    // Remove the title from the beginning if it's duplicated
    content = content.replace(new RegExp(`^ORS\\s*${sectionNumber.replace('.', '\\.')}\\s*[-–—]?\\s*${title}\\s*`, 'i'), '');
    content = content.replace(new RegExp(`^ORS\\s*${sectionNumber.replace('.', '\\.')}\\s*`, 'i'), '');

    return { title, content, url };
  } catch (error) {
    console.error(`  Error fetching ${sectionNumber}:`, error.message);
    return null;
  }
}

/**
 * Generate embedding for text
 */
async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const startIndex = args[0] ? parseInt(args[0]) : 0;
  const batchSize = args[1] ? parseInt(args[1]) : 10;
  const endIndex = Math.min(startIndex + batchSize, ALL_ORS_90_SECTIONS.length);

  console.log('===========================================');
  console.log('  Oregon ORS Chapter 90 Complete Ingestion');
  console.log('===========================================');
  console.log(`Total sections in ORS 90: ${ALL_ORS_90_SECTIONS.length}`);
  console.log(`Processing sections ${startIndex + 1} to ${endIndex}`);
  console.log('');

  // Check environment
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing Supabase environment variables');
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: Missing OPENAI_API_KEY');
    process.exit(1);
  }

  let inserted = 0;
  let errors = 0;
  let skipped = 0;

  const sectionsToProcess = ALL_ORS_90_SECTIONS.slice(startIndex, endIndex);

  for (let i = 0; i < sectionsToProcess.length; i++) {
    const section = sectionsToProcess[i];
    const globalIndex = startIndex + i + 1;

    console.log(`\n[${globalIndex}/${ALL_ORS_90_SECTIONS.length}] Processing ORS ${section}...`);

    try {
      // Fetch content from oregon.public.law
      const data = await fetchSectionContent(section);

      if (!data) {
        console.log(`  ⚠ Failed to fetch`);
        errors++;
        continue;
      }

      if (!data.content || data.content.length < 20) {
        console.log(`  ⚠ Skipped (no content or too short)`);
        skipped++;
        continue;
      }

      // Check if section already exists
      const { data: existing } = await supabase
        .from('knowledge_chunks')
        .select('id')
        .eq('source_section', section)
        .eq('source_type', 'ors_90')
        .maybeSingle();

      if (existing) {
        console.log(`  ⏭ Already exists, skipping`);
        skipped++;
        continue;
      }

      // Prepare content for embedding
      const fullContent = `ORS ${section} - ${data.title}\n\n${data.content}`;

      // Truncate if too long (embedding model limit)
      const truncatedContent = fullContent.length > 8000
        ? fullContent.substring(0, 8000) + '...'
        : fullContent;

      // Generate embedding
      const embedding = await generateEmbedding(truncatedContent);

      // Insert into database
      const { error } = await supabase.from('knowledge_chunks').insert({
        content: truncatedContent,
        embedding: embedding,
        source_type: 'ors_90',
        source_title: `ORS ${section} - ${data.title}`,
        source_url: data.url,
        source_section: section,
      });

      if (error) {
        console.error(`  ✗ Error:`, error.message);
        errors++;
      } else {
        console.log(`  ✓ Inserted: ${data.title.substring(0, 60)}${data.title.length > 60 ? '...' : ''}`);
        inserted++;
      }

      // Rate limiting - be respectful to the API and avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (err) {
      console.error(`  ✗ Error:`, err.message);
      errors++;
    }
  }

  console.log('\n===========================================');
  console.log('  Batch Complete');
  console.log('===========================================');
  console.log(`Sections processed: ${sectionsToProcess.length}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (existing or empty): ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (endIndex < ALL_ORS_90_SECTIONS.length) {
    console.log(`\n📋 Next batch command:`);
    console.log(`   node scripts/fetch-ors90-complete.mjs ${endIndex} ${batchSize}`);
  } else {
    console.log('\n✅ All sections have been processed!');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
