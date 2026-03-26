require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

// Property Meld OAuth
const PM_BASE = "https://app.propertymeld.com";
const PM_CLIENT_ID = process.env.PROPERTY_MELD_CLIENT_ID;
const PM_CLIENT_SECRET = process.env.PROPERTY_MELD_CLIENT_SECRET;

// AppFolio
const V0_BASE = "https://api.appfolio.com/api/v0";
const AF_CLIENT_ID = process.env.APPFOLIO_CLIENT_ID;
const AF_CLIENT_SECRET = process.env.APPFOLIO_CLIENT_SECRET;
const AF_DEV_ID = process.env.APPFOLIO_DEVELOPER_ID;
const afAuth = Buffer.from(`${AF_CLIENT_ID}:${AF_CLIENT_SECRET}`).toString("base64");

function normalizeAddress(addr) {
  return (addr || "")
    .toLowerCase()
    .trim()
    .replace(/[.,#]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\b(street|st)\b/g, "st")
    .replace(/\b(avenue|ave)\b/g, "ave")
    .replace(/\b(drive|dr)\b/g, "dr")
    .replace(/\b(road|rd)\b/g, "rd")
    .replace(/\b(lane|ln)\b/g, "ln")
    .replace(/\b(boulevard|blvd)\b/g, "blvd")
    .replace(/\b(circle|cir)\b/g, "cir")
    .replace(/\b(court|ct)\b/g, "ct")
    .replace(/\b(place|pl)\b/g, "pl")
    .replace(/\b(southwest|sw)\b/g, "sw")
    .replace(/\b(southeast|se)\b/g, "se")
    .replace(/\b(northwest|nw)\b/g, "nw")
    .replace(/\b(northeast|ne)\b/g, "ne");
}

function normalizeUnit(unitId, unitName) {
  const raw = (unitName || unitId || "").toLowerCase().trim();
  return raw.replace(/^(unit|apt|#)\s*/i, "").trim();
}

async function main() {
  // Get a few PM properties
  const tokenRes = await fetch(`${PM_BASE}/api/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${PM_CLIENT_ID}&client_secret=${PM_CLIENT_SECRET}`,
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;

  // Get multitenant ID
  const mgmtRes = await fetch(`${PM_BASE}/api/management_companies/`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const mgmtData = await mgmtRes.json();
  const multitenantId = mgmtData.results[0].multitenant_company_id;

  // Get first 10 PM properties
  const propRes = await fetch(`${PM_BASE}/api/properties/?limit=10`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-PM-MULTITENANT-ID": String(multitenantId),
      Accept: "application/json",
    },
  });
  const propData = await propRes.json();
  const pmProps = propData.results || [];

  // Get PM units for those properties
  const unitRes = await fetch(`${PM_BASE}/api/units/?limit=20`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-PM-MULTITENANT-ID": String(multitenantId),
      Accept: "application/json",
    },
  });
  const unitData = await unitRes.json();
  const pmUnits = unitData.results || [];

  console.log("=== Property Meld Sample Addresses ===");
  pmProps.slice(0, 5).forEach(p => {
    console.log(`  PM Property: line_1="${p.line_1}" city="${p.city}" unit="${p.unit || ""}" property_name="${p.property_name || ""}"`);
    console.log(`    Normalized: "${normalizeAddress(p.line_1)}|"`);
  });

  console.log("\n=== PM Units ===");
  pmUnits.slice(0, 5).forEach(u => {
    console.log(`  PM Unit: unit="${u.unit}" unit_address="${u.unit_address}" property_id=${u.property_id || u.property}`);
    console.log(`    Normalized unit: "${normalizeUnit(null, u.unit)}"`);
  });

  // Get first page of AppFolio tenants
  const afRes = await fetch(`${V0_BASE}/tenants?filters[LastUpdatedAtFrom]=2000-01-01T00:00:00Z&page[number]=1&page[size]=10`, {
    headers: {
      Authorization: `Basic ${afAuth}`,
      "X-AppFolio-Developer-ID": AF_DEV_ID,
      Accept: "application/json",
    },
  });
  const afData = await afRes.json();
  const afTenants = (afData.data || []).filter(t => t.Status === "Current");

  console.log("\n=== AppFolio Sample Tenants ===");
  afTenants.slice(0, 5).forEach(t => {
    const addr = t.Addresses?.[0];
    console.log(`  AF Tenant: "${addr?.Address1}" "${addr?.Address2 || ""}" | MoveIn: ${t.MoveInOn} | Unit: ${t.UnitId}`);
    console.log(`    Normalized: "${normalizeAddress(addr?.Address1)}|${normalizeUnit(t.UnitId, addr?.Address2)}"`);
  });

  // Now test matching: try to match PM addresses to AF addresses
  console.log("\n=== Match Test ===");

  // Build AF lookup from ALL current tenants (just first 200 for test)
  const afAllRes = await fetch(`${V0_BASE}/tenants?filters[LastUpdatedAtFrom]=2000-01-01T00:00:00Z&page[number]=1&page[size]=200`, {
    headers: {
      Authorization: `Basic ${afAuth}`,
      "X-AppFolio-Developer-ID": AF_DEV_ID,
      Accept: "application/json",
    },
  });
  const afAllData = await afAllRes.json();
  const afAll = (afAllData.data || []).filter(t => t.Status === "Current" && t.MoveInOn);

  const moveInByAddress = new Map();
  for (const t of afAll) {
    const addr = t.Addresses?.[0];
    const normAddr = normalizeAddress(addr?.Address1);
    const normUnit = normalizeUnit(t.UnitId, addr?.Address2);
    const key = `${normAddr}|${normUnit}`;
    moveInByAddress.set(key, t.MoveInOn);
  }

  console.log(`AF lookup entries: ${moveInByAddress.size}`);

  // Try matching PM properties
  let matched = 0;
  let unmatched = 0;
  for (const p of pmProps) {
    const pmAddr = normalizeAddress(p.line_1);
    const pmUnit = normalizeUnit(null, "");
    const key = `${pmAddr}|${pmUnit}`;
    const moveIn = moveInByAddress.get(key);
    if (moveIn) {
      matched++;
      console.log(`  MATCH: "${key}" -> MoveIn: ${moveIn}`);
    } else {
      unmatched++;
      console.log(`  NO MATCH: "${key}"`);
      // Show closest AF keys
      const similar = [...moveInByAddress.keys()].filter(k => k.includes(pmAddr.split(" ")[0])).slice(0, 3);
      if (similar.length > 0) {
        console.log(`    Closest AF keys: ${similar.join(", ")}`);
      }
    }
  }
  console.log(`\nMatched: ${matched}, Unmatched: ${unmatched}`);
}

main().catch(console.error);
