require("dotenv").config({ path: ".env.local" });

const APPFOLIO_V0_BASE = 'https://api.appfolio.com/api/v0';

async function fetchAllPages(headers, path, max = 10000) {
  let url = `${APPFOLIO_V0_BASE}${path}`;
  const all = [];
  while (url && all.length < max) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${url} → ${res.status}: ${await res.text()}`);
    const json = await res.json();
    all.push(...(json.data || []));
    if (json.next_page_path) {
      url = json.next_page_path.startsWith('/api/v0')
        ? `https://api.appfolio.com${json.next_page_path}`
        : `${APPFOLIO_V0_BASE}${json.next_page_path}`;
    } else url = null;
  }
  return all;
}

async function main() {
  const clientId = process.env.APPFOLIO_CLIENT_ID;
  const clientSecret = process.env.APPFOLIO_CLIENT_SECRET;
  const developerId = process.env.APPFOLIO_DEVELOPER_ID;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const headers = {
    Authorization: `Basic ${auth}`,
    'X-AppFolio-Developer-ID': developerId,
    Accept: 'application/json',
  };

  console.log('Fetching all current tenants...');
  const tenants = await fetchAllPages(
    headers,
    '/tenants?filters[LastUpdatedAtFrom]=2020-01-01T00:00:00Z&page[number]=1&page[size]=500'
  );
  const current = tenants.filter((t) => !t.HiddenAt && t.Status === 'Current' && t.PrimaryTenant);
  console.log(`Total tenants: ${tenants.length}, current primary: ${current.length}`);

  // Look for insurance signals in tags
  const tagCounts = new Map();
  let withTags = 0;
  for (const t of current) {
    if (Array.isArray(t.Tags) && t.Tags.length > 0) {
      withTags++;
      for (const tag of t.Tags) {
        const key = typeof tag === 'string' ? tag : JSON.stringify(tag);
        tagCounts.set(key, (tagCounts.get(key) || 0) + 1);
      }
    }
  }
  console.log(`\nCurrent tenants with any Tags: ${withTags}`);
  if (tagCounts.size) {
    console.log('Tag frequency:');
    Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, v]) => {
      console.log(`  ${v.toString().padStart(4)}  ${k}`);
    });
  }

  // Look for OccupancyCustomFields
  let withOccupancyCustom = 0;
  const occupancyCustomKeys = new Map();
  for (const t of current) {
    if (t.OccupancyCustomFields && typeof t.OccupancyCustomFields === 'object') {
      withOccupancyCustom++;
      for (const k of Object.keys(t.OccupancyCustomFields)) {
        occupancyCustomKeys.set(k, (occupancyCustomKeys.get(k) || 0) + 1);
      }
    }
  }
  console.log(`\nCurrent tenants with OccupancyCustomFields: ${withOccupancyCustom}`);
  if (occupancyCustomKeys.size) {
    console.log('OccupancyCustomField keys (freq):');
    Array.from(occupancyCustomKeys.entries()).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
      console.log(`  ${v.toString().padStart(4)}  ${k}`);
    });
    // Show a few sample values
    console.log('\nSample OccupancyCustomFields content:');
    const samples = current.filter((t) => t.OccupancyCustomFields && Object.keys(t.OccupancyCustomFields).length).slice(0, 3);
    for (const t of samples) {
      console.log(`  ${t.FirstName} ${t.LastName}: ${JSON.stringify(t.OccupancyCustomFields).slice(0, 400)}`);
    }
  }

  // Check property CustomFields
  console.log('\nFetching properties...');
  const properties = await fetchAllPages(
    headers,
    '/properties?filters[LastUpdatedAtFrom]=2020-01-01T00:00:00Z&page[number]=1&page[size]=500'
  );
  console.log(`Total properties: ${properties.length}`);
  const customFieldKeys = new Map();
  for (const p of properties) {
    if (Array.isArray(p.CustomFields)) {
      for (const cf of p.CustomFields) {
        if (cf && cf.Name) customFieldKeys.set(cf.Name, (customFieldKeys.get(cf.Name) || 0) + 1);
      }
    } else if (p.CustomFields && typeof p.CustomFields === 'object') {
      for (const k of Object.keys(p.CustomFields)) {
        customFieldKeys.set(k, (customFieldKeys.get(k) || 0) + 1);
      }
    }
  }
  console.log(`\nProperty CustomField key freq (top 20):`);
  Array.from(customFieldKeys.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => {
    console.log(`  ${v.toString().padStart(4)}  ${k}`);
  });

  // Look at one property's CustomFields raw
  const propWithCF = properties.find((p) => (Array.isArray(p.CustomFields) ? p.CustomFields.length : p.CustomFields));
  if (propWithCF) {
    console.log('\nSample property CustomFields:', JSON.stringify(propWithCF.CustomFields).slice(0, 1000));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
