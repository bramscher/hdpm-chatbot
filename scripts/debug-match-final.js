require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const V0_BASE = "https://api.appfolio.com/api/v0";
const AF_CLIENT_ID = process.env.APPFOLIO_CLIENT_ID;
const AF_SECRET = process.env.APPFOLIO_CLIENT_SECRET;
const AF_DEV_ID = process.env.APPFOLIO_DEVELOPER_ID;
const afAuth = Buffer.from(`${AF_CLIENT_ID}:${AF_SECRET}`).toString("base64");

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function norm(addr) {
  return (addr || "")
    .toLowerCase().trim()
    .replace(/[.,#]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\broad\b/g, "rd")
    .replace(/\blane\b/g, "ln")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\bcircle\b/g, "cir")
    .replace(/\bcourt\b/g, "ct")
    .replace(/\bplace\b/g, "pl");
}

async function main() {
  // Get Supabase inspection properties (first 20)
  const { data: props } = await supabase.from("inspection_properties").select("address_1, address_2, city").limit(20);

  // Get AppFolio tenants (first 200 current)
  const afRes = await fetch(`${V0_BASE}/tenants?filters[LastUpdatedAtFrom]=2000-01-01T00:00:00Z&page[number]=1&page[size]=200`, {
    headers: { Authorization: `Basic ${afAuth}`, "X-AppFolio-Developer-ID": AF_DEV_ID, Accept: "application/json" },
  });
  const afData = await afRes.json();
  const afCurrent = (afData.data || []).filter(t => t.Status === "Current" && t.MoveInOn);

  // Build AF lookup by normalized address
  const afByAddr = new Map();
  for (const t of afCurrent) {
    const addr = t.Addresses?.[0];
    const key = norm(addr?.Address1);
    if (key) afByAddr.set(key, { moveIn: t.MoveInOn, raw: addr?.Address1, unit: addr?.Address2 });
  }

  console.log(`Supabase properties: ${props.length}`);
  console.log(`AppFolio current tenants (page 1): ${afCurrent.length}`);
  console.log(`AF address lookup entries: ${afByAddr.size}\n`);

  let matched = 0;
  let unmatched = 0;

  for (const p of props) {
    const pmNorm = norm(p.address_1);
    const afMatch = afByAddr.get(pmNorm);
    if (afMatch) {
      matched++;
      console.log(`MATCH: PM="${p.address_1}" -> AF="${afMatch.raw}" MoveIn=${afMatch.moveIn}`);
    } else {
      unmatched++;
      // Find similar
      const similar = [...afByAddr.keys()].filter(k => {
        const pmWords = pmNorm.split(" ");
        return pmWords.some(w => w.length > 3 && k.includes(w));
      }).slice(0, 2);
      console.log(`MISS:  PM="${p.address_1}" (norm: "${pmNorm}")`);
      if (similar.length) console.log(`       Similar AF: ${similar.map(k => afByAddr.get(k).raw).join(", ")}`);
    }
  }

  console.log(`\nMatched: ${matched}/${props.length} (${Math.round(matched/props.length*100)}%)`);
}

main().catch(console.error);
