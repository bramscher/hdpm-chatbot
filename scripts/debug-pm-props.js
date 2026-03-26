require("dotenv").config({ path: ".env.local" });

const PM_API_URL = process.env.PROPERTY_MELD_API_URL || "https://api.propertymeld.com";
const PM_CLIENT_ID = process.env.PROPERTY_MELD_CLIENT_ID;
const PM_CLIENT_SECRET = process.env.PROPERTY_MELD_CLIENT_SECRET;

const V0_BASE = "https://api.appfolio.com/api/v0";
const AF_CLIENT_ID = process.env.APPFOLIO_CLIENT_ID;
const AF_SECRET = process.env.APPFOLIO_CLIENT_SECRET;
const AF_DEV_ID = process.env.APPFOLIO_DEVELOPER_ID;
const afAuth = Buffer.from(`${AF_CLIENT_ID}:${AF_SECRET}`).toString("base64");

async function main() {
  // Get PM token
  const tokenRes = await fetch(`${PM_API_URL}/api/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${PM_CLIENT_ID}&client_secret=${PM_CLIENT_SECRET}`,
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;

  // Get multitenant ID
  const mgmtRes = await fetch(`${PM_API_URL}/api/v2/management-companies/`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const mgmtData = await mgmtRes.json();
  console.log("Management response:", JSON.stringify(mgmtData).substring(0, 500));
  const results = mgmtData.results || mgmtData;
  const multitenantId = Array.isArray(results) ? results[0]?.multitenant_company_id : mgmtData.multitenant_company_id;
  console.log("Multitenant ID:", multitenantId);

  // Get PM properties (first 5)
  const propRes = await fetch(`${PM_API_URL}/api/v2/properties/?limit=5`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-PM-MULTITENANT-ID": String(multitenantId),
      Accept: "application/json",
    },
  });
  const propData = await propRes.json();

  console.log("=== PM Property Keys ===");
  if (propData.results && propData.results[0]) {
    console.log(Object.keys(propData.results[0]));
    console.log("\nFirst 3 PM properties (full):");
    propData.results.slice(0, 3).forEach(p => {
      console.log(JSON.stringify(p, null, 2));
      console.log("---");
    });
  }

  // Get PM units (first 5)
  const unitRes = await fetch(`${PM_API_URL}/api/v2/units/?limit=5`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-PM-MULTITENANT-ID": String(multitenantId),
      Accept: "application/json",
    },
  });
  const unitData = await unitRes.json();

  console.log("\n=== PM Unit Keys ===");
  if (unitData.results && unitData.results[0]) {
    console.log(Object.keys(unitData.results[0]));
    console.log("\nFirst 3 PM units (full):");
    unitData.results.slice(0, 3).forEach(u => {
      console.log(JSON.stringify(u, null, 2));
      console.log("---");
    });
  }

  // Get AF tenants (first 5 current)
  const afRes = await fetch(`${V0_BASE}/tenants?filters[LastUpdatedAtFrom]=2000-01-01T00:00:00Z&page[number]=1&page[size]=10`, {
    headers: {
      Authorization: `Basic ${afAuth}`,
      "X-AppFolio-Developer-ID": AF_DEV_ID,
      Accept: "application/json",
    },
  });
  const afData = await afRes.json();
  const current = (afData.data || []).filter(t => t.Status === "Current");

  console.log("\n=== AF Tenant Sample ===");
  current.slice(0, 3).forEach(t => {
    const addr = t.Addresses?.[0];
    console.log(`Name: ${t.FirstName} ${t.LastName}`);
    console.log(`  PropertyId: ${t.PropertyId}`);
    console.log(`  UnitId: ${t.UnitId}`);
    console.log(`  Address1: ${addr?.Address1}`);
    console.log(`  Address2: ${addr?.Address2}`);
    console.log(`  MoveInOn: ${t.MoveInOn}`);
    console.log("---");
  });
}

main().catch(console.error);
