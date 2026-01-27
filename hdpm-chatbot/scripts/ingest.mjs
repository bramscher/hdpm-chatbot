/**
 * Knowledge Base Ingestion Script
 *
 * Usage:
 *   node scripts/ingest.mjs <file_or_directory> --type <source_type> --title <title> [--url <url>]
 *
 * Examples:
 *   node scripts/ingest.mjs ./docs/ors90.txt --type ors_90 --title "Oregon ORS 90" --url "https://oregon.gov/ors90"
 *   node scripts/ingest.mjs ./policies/ --type policy_doc --title "Company Policies"
 *   node scripts/ingest.mjs ./video-transcript.txt --type loom_video --title "Training Video" --url "https://loom.com/..."
 *
 * Source types: ors_90, loom_video, policy_doc
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
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

// Configuration
const CHUNK_SIZE = 1000; // characters per chunk
const CHUNK_OVERLAP = 200; // overlap between chunks
const EMBEDDING_MODEL = 'text-embedding-3-small';

/**
 * Split text into overlapping chunks
 */
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;

  // Clean up text
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  while (start < text.length) {
    let end = start + chunkSize;

    // Try to break at a sentence or paragraph boundary
    if (end < text.length) {
      // Look for paragraph break first
      const paragraphBreak = text.lastIndexOf('\n\n', end);
      if (paragraphBreak > start + chunkSize / 2) {
        end = paragraphBreak;
      } else {
        // Look for sentence break
        const sentenceBreak = text.lastIndexOf('. ', end);
        if (sentenceBreak > start + chunkSize / 2) {
          end = sentenceBreak + 1;
        }
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) { // Only add chunks with meaningful content
      chunks.push(chunk);
    }

    start = end - overlap;
    if (start < 0) start = 0;
    if (end >= text.length) break;
  }

  return chunks;
}

/**
 * Generate embedding for text
 */
async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Extract section header from chunk if present
 */
function extractSection(chunk) {
  // Look for markdown headers
  const headerMatch = chunk.match(/^#+\s+(.+)$/m);
  if (headerMatch) {
    return headerMatch[1].trim();
  }

  // Look for numbered sections like "90.100" or "Section 1:"
  const sectionMatch = chunk.match(/^(\d+\.\d+|\bSection\s+\d+[:\s])/im);
  if (sectionMatch) {
    return sectionMatch[1].trim();
  }

  return null;
}

/**
 * Ingest a single file
 */
async function ingestFile(filePath, sourceType, sourceTitle, sourceUrl) {
  console.log(`\nProcessing: ${filePath}`);

  const content = fs.readFileSync(filePath, 'utf-8');
  const chunks = chunkText(content);

  console.log(`  Split into ${chunks.length} chunks`);

  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const section = extractSection(chunk);

    try {
      // Generate embedding
      const embedding = await generateEmbedding(chunk);

      // Insert into database
      const { error } = await supabase.from('knowledge_chunks').insert({
        content: chunk,
        embedding: embedding,
        source_type: sourceType,
        source_title: sourceTitle,
        source_url: sourceUrl || null,
        source_section: section,
      });

      if (error) {
        console.error(`  Error inserting chunk ${i + 1}:`, error.message);
        errors++;
      } else {
        inserted++;
        process.stdout.write(`\r  Inserted ${inserted}/${chunks.length} chunks`);
      }

      // Rate limiting - avoid hitting OpenAI limits
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (err) {
      console.error(`\n  Error processing chunk ${i + 1}:`, err.message);
      errors++;
    }
  }

  console.log(`\n  Completed: ${inserted} inserted, ${errors} errors`);
  return { inserted, errors };
}

/**
 * Ingest a directory of files
 */
async function ingestDirectory(dirPath, sourceType, sourceTitle, sourceUrl) {
  const files = fs.readdirSync(dirPath).filter(f =>
    f.endsWith('.txt') || f.endsWith('.md') || f.endsWith('.json')
  );

  console.log(`Found ${files.length} files in ${dirPath}`);

  let totalInserted = 0;
  let totalErrors = 0;

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const fileTitle = `${sourceTitle} - ${path.basename(file, path.extname(file))}`;

    const { inserted, errors } = await ingestFile(filePath, sourceType, fileTitle, sourceUrl);
    totalInserted += inserted;
    totalErrors += errors;
  }

  return { inserted: totalInserted, errors: totalErrors };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 5 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Knowledge Base Ingestion Script

Usage:
  node scripts/ingest.mjs <file_or_directory> --type <source_type> --title <title> [--url <url>]

Arguments:
  file_or_directory  Path to a text file or directory of files to ingest
  --type            Source type: ors_90, loom_video, or policy_doc
  --title           Title for the source
  --url             (Optional) URL to the original source

Examples:
  node scripts/ingest.mjs ./docs/ors90.txt --type ors_90 --title "Oregon ORS 90" --url "https://oregon.gov/ors90"
  node scripts/ingest.mjs ./policies/ --type policy_doc --title "Company Policies"
  node scripts/ingest.mjs ./transcript.txt --type loom_video --title "Training Video" --url "https://loom.com/..."

Source Types:
  ors_90      - Laws and regulations (⚖️)
  loom_video  - Video transcripts (🎬)
  policy_doc  - Policy documents (📄)
    `);
    process.exit(0);
  }

  // Parse arguments
  const inputPath = args[0];
  let sourceType = null;
  let sourceTitle = null;
  let sourceUrl = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--type' && args[i + 1]) {
      sourceType = args[++i];
    } else if (args[i] === '--title' && args[i + 1]) {
      sourceTitle = args[++i];
    } else if (args[i] === '--url' && args[i + 1]) {
      sourceUrl = args[++i];
    }
  }

  // Validate arguments
  if (!inputPath || !sourceType || !sourceTitle) {
    console.error('Error: Missing required arguments. Use --help for usage.');
    process.exit(1);
  }

  const validTypes = ['ors_90', 'loom_video', 'policy_doc'];
  if (!validTypes.includes(sourceType)) {
    console.error(`Error: Invalid source type. Must be one of: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Path does not exist: ${inputPath}`);
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

  console.log('=== Knowledge Base Ingestion ===');
  console.log(`Source Type: ${sourceType}`);
  console.log(`Source Title: ${sourceTitle}`);
  console.log(`Source URL: ${sourceUrl || '(none)'}`);

  const stats = fs.statSync(inputPath);
  let result;

  if (stats.isDirectory()) {
    result = await ingestDirectory(inputPath, sourceType, sourceTitle, sourceUrl);
  } else {
    result = await ingestFile(inputPath, sourceType, sourceTitle, sourceUrl);
  }

  console.log('\n=== Ingestion Complete ===');
  console.log(`Total chunks inserted: ${result.inserted}`);
  console.log(`Total errors: ${result.errors}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
