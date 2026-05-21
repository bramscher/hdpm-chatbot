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

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  console.log('=== /showings — with LastUpdatedAtFrom filter ===');
  const showingsRes = await fetch(
    `${APPFOLIO_V0_BASE}/showings?filters[LastUpdatedAtFrom]=${ninetyDaysAgo.toISOString()}&page[number]=1&page[size]=5`,
    { headers }
  );
  console.log(`status: ${showingsRes.status}`);
  if (showingsRes.ok) {
    const json = await showingsRes.json();
    console.log(`returned: ${(json.data || []).length}`);
    for (const s of (json.data || []).slice(0, 3)) {
      console.log(JSON.stringify(s, null, 2));
      console.log('--- keys:', Object.keys(s).sort().join(', '));
      console.log('');
    }
  } else {
    console.log(await showingsRes.text());
  }

  // Walk all showings in last 90 days
  console.log('\n=== /showings — count across last 90 days ===');
  try {
    const showings = await fetchAllPages(
      headers,
      `/showings?filters[LastUpdatedAtFrom]=${ninetyDaysAgo.toISOString()}&page[number]=1&page[size]=500`
    );
    console.log(`Total showings (last 90d): ${showings.length}`);
    if (showings.length) {
      // Sample fields
      const sampleKeys = new Set();
      for (const s of showings.slice(0, 30)) Object.keys(s).forEach((k) => sampleKeys.add(k));
      console.log('Fields seen:', Array.from(sampleKeys).sort().join(', '));
      // Are LeadId/GuestCardId fields present?
      const withLeadRef = showings.filter((s) => s.LeadId || s.GuestCardId).length;
      console.log(`Showings with LeadId or GuestCardId: ${withLeadRef}/${showings.length}`);
    }
  } catch (e) {
    console.log('Error fetching all showings:', e.message);
  }

  // Lead first-contact proxy: gap between CreatedAt and LastUpdatedAt for non-active leads
  console.log('\n=== Lead first-response proxy (last 90 days) ===');
  const leads = await fetchAllPages(
    headers,
    `/leads?filters[LastUpdatedAtFrom]=${ninetyDaysAgo.toISOString()}&page[number]=1&page[size]=500`
  );
  console.log(`Total leads: ${leads.length}`);
  // Among leads that progressed past "active", LastUpdatedAt - CreatedAt is a rough first-response proxy
  const moved = leads.filter((l) => l.Status && l.Status !== 'active' && l.CreatedAt && l.LastUpdatedAt);
  console.log(`Leads with progressed status: ${moved.length}`);
  const gaps = moved.map((l) => (new Date(l.LastUpdatedAt) - new Date(l.CreatedAt)) / (1000 * 60 * 60)); // hours
  if (gaps.length) {
    gaps.sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const under1h = gaps.filter((g) => g <= 1).length;
    const under24h = gaps.filter((g) => g <= 24).length;
    console.log(`Avg gap CreatedAt→LastUpdatedAt: ${avg.toFixed(1)}h, median: ${median.toFixed(1)}h`);
    console.log(`<1h:  ${under1h} (${((under1h / gaps.length) * 100).toFixed(1)}%)`);
    console.log(`<24h: ${under24h} (${((under24h / gaps.length) * 100).toFixed(1)}%)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
