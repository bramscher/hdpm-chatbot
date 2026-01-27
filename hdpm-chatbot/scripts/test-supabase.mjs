import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Supabase connection...\n');
console.log('URL:', url);
console.log('Service Key:', serviceKey ? `${serviceKey.substring(0, 20)}...` : 'NOT SET');

if (!url || !serviceKey) {
  console.error('\n❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function testConnection() {
  try {
    // Test 1: Basic connection - list tables
    console.log('\n1. Testing basic connection...');
    const { data: tables, error: tablesError } = await supabase
      .from('knowledge_chunks')
      .select('id')
      .limit(1);

    if (tablesError) {
      if (tablesError.code === '42P01') {
        console.log('   ⚠️  Table "knowledge_chunks" does not exist yet');
        console.log('   You need to create it with the SQL from the README');
      } else {
        console.log('   ❌ Error:', tablesError.message);
      }
    } else {
      console.log('   ✅ Connected to knowledge_chunks table');
      console.log('   Found', tables?.length || 0, 'row(s)');
    }

    // Test 2: Check if vector extension exists
    console.log('\n2. Checking pgvector extension...');
    const { data: extensions, error: extError } = await supabase
      .rpc('check_vector_extension');

    if (extError) {
      // Try alternative check
      const { error: altError } = await supabase
        .from('knowledge_chunks')
        .select('embedding')
        .limit(0);

      if (altError && altError.message.includes('vector')) {
        console.log('   ⚠️  Vector extension may not be enabled');
      } else {
        console.log('   ✅ Connection works (extension check skipped)');
      }
    } else {
      console.log('   ✅ pgvector extension is enabled');
    }

    // Test 3: Check if match_knowledge_chunks function exists
    console.log('\n3. Checking match_knowledge_chunks function...');
    const testEmbedding = new Array(1536).fill(0);
    const { data: matchData, error: matchError } = await supabase
      .rpc('match_knowledge_chunks', {
        query_embedding: testEmbedding,
        threshold: 0.0,
        count: 1
      });

    if (matchError) {
      if (matchError.code === '42883') {
        console.log('   ⚠️  Function "match_knowledge_chunks" does not exist');
        console.log('   You need to create it with the SQL from the README');
      } else {
        console.log('   ❌ Error:', matchError.message);
      }
    } else {
      console.log('   ✅ Function exists and works');
      console.log('   Returned', matchData?.length || 0, 'result(s)');
    }

    console.log('\n✅ Supabase connection test complete!');

  } catch (err) {
    console.error('\n❌ Connection failed:', err.message);
    process.exit(1);
  }
}

testConnection();
