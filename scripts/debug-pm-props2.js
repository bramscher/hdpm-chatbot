require("dotenv").config({ path: ".env.local" });

const PM_API_URL = process.env.PROPERTY_MELD_API_URL || "https://api.propertymeld.com";
const PM_CLIENT_ID = process.env.PROPERTY_MELD_CLIENT_ID;
const PM_CLIENT_SECRET = process.env.PROPERTY_MELD_CLIENT_SECRET;

async function pmFetch(path) {
  // Get token
  const tokenRes = await fetch(`${PM_API_URL}/api/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${PM_CLIENT_ID}&client_secret=${PM_CLIENT_SECRET}`,
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;

  // Get multitenant
  const mgmtRes = await fetch(`${PM_API_URL}/api/v2/management/`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const mgmtData = await mgmtRes.json();
  const multitenantId = mgmtData.results[0].multitenant_id || mgmtData.results[0].id;

  // Fetch
  const res = await fetch(`${PM_API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-PM-MULTITENANT-ID": String(multitenantId),
      Accept: "application/json",
    },
  });
  return res.json();
}

async function main() {
  const propData = await pmFetch("/api/v2/properties/?limit=5");

  console.log("=== PM Property Sample (ALL fields) ===");
  if (propData.results) {
    propData.results.slice(0, 3).forEach((p, i) => {
      console.log(`\nProperty ${i + 1}:`);
      console.log(JSON.stringify(p, null, 2));
    });
  }

  const unitData = await pmFetch("/api/v2/units/?limit=5");
  console.log("\n=== PM Unit Sample (ALL fields) ===");
  if (unitData.results) {
    unitData.results.slice(0, 3).forEach((u, i) => {
      console.log(`\nUnit ${i + 1}:`);
      console.log(JSON.stringify(u, null, 2));
    });
  }
}

main().catch(console.error);
