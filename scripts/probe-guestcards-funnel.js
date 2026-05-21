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

const LEAD_APPLIED_STATUSES = new Set([
  'applied_review', 'applied_canceled', 'applied_denied', 'converted',
]);

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

  const [leads, rentalApps] = await Promise.all([
    fetchAllPages(headers, `/leads?filters[LastUpdatedAtFrom]=${ninetyDaysAgo.toISOString()}&page[number]=1&page[size]=500`),
    fetchAllPages(headers, `/rental_applications?filters[SubmittedAtFrom]=${ninetyDaysAgo.toISOString()}&page[number]=1&page[size]=500`),
  ]);

  const recentLeads = leads.filter((l) => new Date(l.CreatedAt) >= ninetyDaysAgo);
  const approvedAppIds = new Set(rentalApps.filter((a) => a.Status === 'approved').map((a) => a.Id));

  const guestCards = recentLeads.length;
  const applications = recentLeads.filter((l) => !!l.RentalApplicationId || LEAD_APPLIED_STATUSES.has(l.Status)).length;
  const approvals = recentLeads.filter((l) =>
    l.Status === 'converted' ||
    (l.RentalApplicationId != null && approvedAppIds.has(l.RentalApplicationId))
  ).length;
  const moveIns = recentLeads.filter((l) => l.Status === 'converted').length;

  console.log('=== New Leasing Funnel (cohort-anchored on recentLeads) ===');
  console.log(`Guest Cards: ${guestCards}`);
  console.log(`Applications: ${applications}  (${(applications / guestCards * 100).toFixed(1)}%)`);
  console.log(`Approvals:    ${approvals}  (${(approvals / applications * 100 || 0).toFixed(1)}% of apps)`);
  console.log(`Move-Ins:     ${moveIns}  (${(moveIns / approvals * 100 || 0).toFixed(1)}% of approvals)`);
  console.log(`Overall conversion: ${(moveIns / guestCards * 100).toFixed(1)}%`);

  // Sanity: recentLeads status breakdown
  console.log('\nrecentLeads Status distribution:');
  const m = new Map();
  for (const l of recentLeads) m.set(l.Status, (m.get(l.Status) || 0) + 1);
  for (const [s, n] of Array.from(m.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n.toString().padStart(5)}  ${s}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
