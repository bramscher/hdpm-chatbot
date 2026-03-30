require("dotenv").config({ path: ".env.local" });

const PM_API_URL = process.env.PROPERTY_MELD_API_URL || "https://api.propertymeld.com";
const PM_CLIENT_ID = process.env.PROPERTY_MELD_CLIENT_ID || "";
const PM_CLIENT_SECRET = process.env.PROPERTY_MELD_CLIENT_SECRET || "";

async function main() {
  // Get token
  const tokenRes = await fetch(`${PM_API_URL}/api/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: PM_CLIENT_ID,
      client_secret: PM_CLIENT_SECRET,
    }),
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;
  console.log("Token:", token.slice(0, 12) + "...");

  // Get management
  const mgmtRes = await fetch(`${PM_API_URL}/api/v2/management/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const mgmt = await mgmtRes.json();
  const mtId = mgmt.results[0].multitenant_id || mgmt.results[0].id;
  console.log("Multitenant ID:", mtId);

  // Get first few units with ALL fields
  const unitsRes = await fetch(`${PM_API_URL}/api/v2/unit/?limit=5`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Multitenant-Id": String(mtId),
    },
  });
  const units = await unitsRes.json();
  console.log("\n=== UNIT FIELDS ===");
  console.log("Total units:", units.count);
  if (units.results.length > 0) {
    console.log("\nAll fields:", Object.keys(units.results[0]).sort().join(", "));
    console.log("\nSample unit (full):");
    console.log(JSON.stringify(units.results[0], null, 2));
  }

  // Get first few residents with ALL fields
  const resRes = await fetch(`${PM_API_URL}/api/v2/resident/?limit=5`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Multitenant-Id": String(mtId),
    },
  });
  const residents = await resRes.json();
  console.log("\n=== RESIDENT FIELDS ===");
  console.log("Total residents:", residents.count);
  if (residents.results.length > 0) {
    console.log("\nAll fields:", Object.keys(residents.results[0]).sort().join(", "));
    console.log("\nSample resident (full):");
    console.log(JSON.stringify(residents.results[0], null, 2));
  }

  // Check if there's a lease endpoint
  for (const endpoint of ["/api/v2/lease/", "/api/v2/tenancy/", "/api/v2/occupancy/"]) {
    try {
      const res = await fetch(`${PM_API_URL}${endpoint}?limit=3`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Multitenant-Id": String(mtId),
        },
      });
      console.log(`\n=== ${endpoint} (${res.status}) ===`);
      if (res.ok) {
        const data = await res.json();
        console.log("Count:", data.count);
        if (data.results && data.results.length > 0) {
          console.log("Fields:", Object.keys(data.results[0]).sort().join(", "));
          console.log("Sample:", JSON.stringify(data.results[0], null, 2));
        }
      }
    } catch (e) {
      console.log(`${endpoint}: error -`, e.message);
    }
  }
}

main().catch(console.error);
