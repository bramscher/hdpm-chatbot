require("dotenv").config({ path: ".env.local" });

const APPFOLIO_V0_BASE = 'https://api.appfolio.com/api/v0';

async function fetchAllPages(url, headers, max = 5000) {
  const all = [];
  let next = url;
  while (next && all.length < max) {
    const res = await fetch(next, { headers });
    if (!res.ok) throw new Error(`${next} → ${res.status}: ${await res.text()}`);
    const json = await res.json();
    all.push(...(json.data || []));
    if (json.next_page_path) {
      const path = json.next_page_path.startsWith('/api/v0')
        ? `https://api.appfolio.com${json.next_page_path}`
        : `${APPFOLIO_V0_BASE}${json.next_page_path}`;
      next = path;
    } else {
      next = null;
    }
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

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  console.log('Fetching GL accounts + bills (last 30d)...');
  const [glAccounts, bills] = await Promise.all([
    fetchAllPages(`${APPFOLIO_V0_BASE}/gl_accounts?page[number]=1&page[size]=200`, headers),
    fetchAllPages(
      `${APPFOLIO_V0_BASE}/bills?filters[LastUpdatedAtFrom]=${thirtyDaysAgo.toISOString()}&page[number]=1&page[size]=200`,
      headers
    ),
  ]);

  const maintenanceIds = new Set(
    glAccounts
      .filter((a) => a.AccountType === 'ExpenseGlAccount' && (a.Number || '').startsWith('6'))
      .map((a) => a.Id)
  );
  const idToName = new Map(glAccounts.map((a) => [a.Id, `${a.Number} ${a.Name || a.AccountName}`]));

  console.log(`\nMaintenance GL ids: ${maintenanceIds.size}`);
  console.log(`Bills in window: ${bills.length}`);

  let totalAll = 0;
  let totalMaint = 0;
  const byCategory = new Map();
  for (const bill of bills) {
    totalAll += parseFloat(bill.TotalAmount || '0');
    for (const li of bill.LineItems || []) {
      const amt = parseFloat(li.Amount || '0');
      if (li.GlAccountId && maintenanceIds.has(li.GlAccountId)) {
        totalMaint += amt;
        const k = idToName.get(li.GlAccountId) || li.GlAccountId;
        byCategory.set(k, (byCategory.get(k) || 0) + amt);
      }
    }
  }

  console.log(`\nTotal bills (all categories):  $${totalAll.toFixed(2)}`);
  console.log(`Maintenance only:              $${totalMaint.toFixed(2)}`);
  console.log(`Ratio maintenance/total:       ${totalAll > 0 ? ((totalMaint / totalAll) * 100).toFixed(1) : 0}%`);

  console.log('\nBy maintenance category (last 30d):');
  const sorted = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);
  for (const [name, amt] of sorted) {
    console.log(`  $${amt.toFixed(2).padStart(12)}  ${name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
