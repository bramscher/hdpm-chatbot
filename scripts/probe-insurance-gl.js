require("dotenv").config({ path: ".env.local" });

const APPFOLIO_V0_BASE = 'https://api.appfolio.com/api/v0';

async function fetchAllPages(headers, path, max = 50000) {
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

  const insuranceIncomeGlIds = new Set([
    '3356037d-a406-11ec-93cd-0adb2565839e', // 00000000-14
    '335624d4-a406-11ec-93cd-0adb2565839e', // 00000000-13
  ]);

  // Pull journal entries over the last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  console.log('Fetching journal entries (last 90 days)...');
  const entries = await fetchAllPages(
    headers,
    `/journal_entries?filters[LastUpdatedAtFrom]=${ninetyDaysAgo.toISOString()}&page[number]=1&page[size]=500`
  );
  console.log(`Total journal entries (last 90d): ${entries.length}`);

  // Filter to entries that touch an insurance income GL
  const insuranceEntries = entries.filter((e) =>
    (e.LineItems || []).some((li) => li.GlAccountId && insuranceIncomeGlIds.has(li.GlAccountId))
  );
  console.log(`Entries touching insurance income GLs: ${insuranceEntries.length}`);

  if (insuranceEntries.length) {
    console.log('\nFirst 3 insurance entries:');
    for (const e of insuranceEntries.slice(0, 3)) {
      console.log(JSON.stringify(e, null, 2));
      console.log('---');
    }

    // Aggregate by PropertyId
    const byProperty = new Map();
    for (const e of insuranceEntries) {
      const pid = e.PropertyId || '(none)';
      byProperty.set(pid, (byProperty.get(pid) || 0) + 1);
    }
    console.log(`\nUnique properties with insurance income entries: ${byProperty.size}`);

    // Check for OccupancyId / TenantId on line items
    const liKeys = new Set();
    for (const e of insuranceEntries) {
      for (const li of e.LineItems || []) {
        Object.keys(li).forEach((k) => liKeys.add(k));
      }
    }
    console.log('LineItem keys seen across insurance entries:', Array.from(liKeys).sort().join(', '));

    // Check Remarks/Description for tenant hints
    console.log('\nSample Remarks/Descriptions on insurance entries:');
    for (const e of insuranceEntries.slice(0, 10)) {
      const liDesc = (e.LineItems || []).map((li) => li.Description || '').filter(Boolean).join(' | ');
      console.log(`  PropertyId=${e.PropertyId?.slice(0, 8)}  Remarks="${(e.Remarks || '').slice(0, 80)}"  LIDesc="${liDesc.slice(0, 100)}"`);
    }

    // Check if there's a sum / total we can extract
    let totalCredit = 0;
    for (const e of insuranceEntries) {
      for (const li of e.LineItems || []) {
        if (li.GlAccountId && insuranceIncomeGlIds.has(li.GlAccountId)) {
          totalCredit += parseFloat(li.Credit || 0);
        }
      }
    }
    console.log(`\nTotal credit on insurance income GLs (last 90d): $${totalCredit.toFixed(2)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
