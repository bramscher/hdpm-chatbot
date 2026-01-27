/**
 * Clear existing ORS 90 data from the knowledge base
 *
 * Run this before re-ingesting to ensure clean, accurate data
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('===========================================');
  console.log('  Clearing ORS 90 Data from Knowledge Base');
  console.log('===========================================\n');

  // Check environment
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing Supabase environment variables');
    process.exit(1);
  }

  // Count existing records
  const { count: beforeCount, error: countError } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('source_type', 'ors_90');

  if (countError) {
    console.error('Error counting records:', countError.message);
    process.exit(1);
  }

  console.log(`Found ${beforeCount} ORS 90 records to delete.\n`);

  if (beforeCount === 0) {
    console.log('No records to delete. Database is clean.');
    return;
  }

  // Confirm deletion
  const args = process.argv.slice(2);
  if (!args.includes('--confirm')) {
    console.log('To delete these records, run with --confirm flag:');
    console.log('  node scripts/clear-ors90-data.mjs --confirm');
    return;
  }

  // Delete all ORS 90 records
  const { error: deleteError } = await supabase
    .from('knowledge_chunks')
    .delete()
    .eq('source_type', 'ors_90');

  if (deleteError) {
    console.error('Error deleting records:', deleteError.message);
    process.exit(1);
  }

  // Verify deletion
  const { count: afterCount } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('source_type', 'ors_90');

  console.log(`✓ Deleted ${beforeCount} records.`);
  console.log(`✓ Remaining ORS 90 records: ${afterCount}`);
  console.log('\nDatabase is ready for fresh ingestion.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
