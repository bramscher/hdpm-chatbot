require("dotenv").config({ path: ".env.local" });

const clientId = process.env.APPFOLIO_CLIENT_ID;
const clientSecret = process.env.APPFOLIO_CLIENT_SECRET;
const developerId = process.env.APPFOLIO_DEVELOPER_ID;
const partnerBase = process.env.APPFOLIO_API_BASE_URL; // v1 partner API

const V0_BASE = "https://api.appfolio.com/api/v0";

const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

async function tryEndpoint(label, url) {
  console.log(`\n--- ${label} ---`);
  console.log(`GET ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        "X-AppFolio-Developer-ID": developerId,
        Accept: "application/json",
      },
    });
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const json = JSON.parse(text);
      const data = json.data || json.results || json;
      const items = Array.isArray(data) ? data : [];
      console.log(`Items: ${items.length}`);
      if (items.length > 0) {
        console.log("First item keys:", Object.keys(items[0]));
        console.log("First item:", JSON.stringify(items[0], null, 2).substring(0, 1500));
      }
    } else {
      console.log("Error:", text.substring(0, 500));
    }
  } catch (err) {
    console.log("Fetch error:", err.message);
  }
}

async function main() {
  console.log("Testing AppFolio API endpoints for tenant/lease data...\n");
  console.log("Client ID:", clientId);
  console.log("Developer ID:", developerId);
  console.log("Partner Base:", partnerBase);

  // v0 API endpoints
  const since = "2020-01-01T00:00:00Z";
  await tryEndpoint("v0 /tenants", `${V0_BASE}/tenants?filters[LastUpdatedAtFrom]=${since}&page[number]=1&page[size]=5`);
  await tryEndpoint("v0 /leases", `${V0_BASE}/leases?filters[LastUpdatedAtFrom]=${since}&page[number]=1&page[size]=5`);
  await tryEndpoint("v0 /occupancies", `${V0_BASE}/occupancies?filters[LastUpdatedAtFrom]=${since}&page[number]=1&page[size]=5`);

  // v1 partner API endpoints
  if (partnerBase) {
    await tryEndpoint("v1 /tenants", `${partnerBase}/tenants?page[number]=1&page[size]=5`);
    await tryEndpoint("v1 /leases", `${partnerBase}/leases?page[number]=1&page[size]=5`);
    await tryEndpoint("v1 /occupancies", `${partnerBase}/occupancies?page[number]=1&page[size]=5`);
  }
}

main();
