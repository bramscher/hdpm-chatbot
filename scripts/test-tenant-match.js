require("dotenv").config({ path: ".env.local" });

const V0_BASE = "https://api.appfolio.com/api/v0";
const clientId = process.env.APPFOLIO_CLIENT_ID;
const clientSecret = process.env.APPFOLIO_CLIENT_SECRET;
const developerId = process.env.APPFOLIO_DEVELOPER_ID;
const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

async function v0Fetch(path, params) {
  const url = new URL(`${V0_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${auth}`,
      "X-AppFolio-Developer-ID": developerId,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  return JSON.parse(text);
}

async function main() {
  // Fetch ALL tenants (paginated)
  const allTenants = [];
  let page = 1;
  while (true) {
    const res = await v0Fetch("/tenants", {
      "filters[LastUpdatedAtFrom]": "2000-01-01T00:00:00Z",
      "page[number]": String(page),
      "page[size]": "200",
    });
    const tenants = res.data || [];
    allTenants.push(...tenants);
    console.log(`Page ${page}: ${tenants.length} tenants`);
    if (tenants.length < 200) break;
    page++;
    if (page > 50) break;
  }

  console.log(`\nTotal tenants: ${allTenants.length}`);

  // Filter current tenants with MoveInOn
  const current = allTenants.filter(t => t.Status === "Current" && t.MoveInOn);
  const pastDue = allTenants.filter(t => t.Status === "Past" || t.Status === "Past Tenant");
  const noMoveIn = allTenants.filter(t => t.Status === "Current" && !t.MoveInOn);

  console.log(`Current with MoveInOn: ${current.length}`);
  console.log(`Past tenants: ${pastDue.length}`);
  console.log(`Current without MoveInOn: ${noMoveIn.length}`);

  // Show unique statuses
  const statuses = {};
  allTenants.forEach(t => {
    statuses[t.Status || "null"] = (statuses[t.Status || "null"] || 0) + 1;
  });
  console.log("\nTenant statuses:", statuses);

  // Show move-in date distribution
  const years = {};
  current.forEach(t => {
    const year = t.MoveInOn.substring(0, 4);
    years[year] = (years[year] || 0) + 1;
  });
  console.log("\nMove-in years (current tenants):", years);

  // Show sample matches with addresses
  console.log("\nSample current tenants:");
  current.slice(0, 5).forEach(t => {
    const addr = t.Addresses?.[0];
    console.log(`  ${t.FirstName} ${t.LastName} | ${addr?.Address1} ${addr?.Address2 || ""} | MoveIn: ${t.MoveInOn} | Lease: ${t.LeaseStartDate}`);
  });
}

main();
