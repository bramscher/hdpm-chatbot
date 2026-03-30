require("dotenv").config({ path: ".env.local" });

const PM_API_URL = process.env.PROPERTY_MELD_API_URL || "https://api.propertymeld.com";
const PM_CLIENT_ID = process.env.PROPERTY_MELD_CLIENT_ID;
const PM_CLIENT_SECRET = process.env.PROPERTY_MELD_CLIENT_SECRET;

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
  console.log("Token response keys:", Object.keys(tokenData));
  const token = tokenData.access_token;
  if (token === undefined) {
    console.log("Full token response:", JSON.stringify(tokenData));
    return;
  }

  // Get multitenant
  const mgmtRes = await fetch(`${PM_API_URL}/api/v2/management/`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const mgmtText = await mgmtRes.text();
  console.log("Management raw:", mgmtText.substring(0, 500));
  const mgmtData = JSON.parse(mgmtText);
  const mt = mgmtData.results?.[0];
  const multitenantId = mt?.multitenant_company_id || mt?.multitenant_id || mt?.id;
  console.log("Multitenant ID:", multitenantId);

  // Get properties
  const propRes = await fetch(`${PM_API_URL}/api/v2/properties/?limit=3`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Multitenant-Id": String(multitenantId),
      Accept: "application/json",
    },
  });
  const propText = await propRes.text();
  console.log("\nProperties raw (first 2000 chars):", propText.substring(0, 2000));
}

main().catch(console.error);
