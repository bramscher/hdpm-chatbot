require("dotenv").config({ path: ".env.local" });

const APPFOLIO_V0_BASE = 'https://api.appfolio.com/api/v0';

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

  // Check a single property's fields
  console.log("=== Property fields (first 2) ===");
  const propRes = await fetch(
    `${APPFOLIO_V0_BASE}/properties?filters[LastUpdatedAtFrom]=2000-01-01T00:00:00Z&page[number]=1&page[size]=2`,
    { headers }
  );
  const propData = await propRes.json();
  for (const p of propData.data || []) {
    console.log(JSON.stringify(p, null, 2));
  }

  // Check a single unit's fields
  console.log("\n=== Unit fields (first 2) ===");
  const unitRes = await fetch(
    `${APPFOLIO_V0_BASE}/units?filters[LastUpdatedAtFrom]=2000-01-01T00:00:00Z&page[number]=1&page[size]=2`,
    { headers }
  );
  const unitData = await unitRes.json();
  for (const u of unitData.data || []) {
    console.log(JSON.stringify(u, null, 2));
  }

  // Check tenant fields (first 2 current tenants)
  console.log("\n=== Tenant fields (first 2) ===");
  const tenantRes = await fetch(
    `${APPFOLIO_V0_BASE}/tenants?filters[LastUpdatedAtFrom]=2000-01-01T00:00:00Z&page[number]=1&page[size]=2`,
    { headers }
  );
  const tenantData = await tenantRes.json();
  for (const t of tenantData.data || []) {
    console.log(JSON.stringify(t, null, 2));
  }
}

main().catch(console.error);
