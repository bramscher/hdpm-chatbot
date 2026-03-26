require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Delete inspections
  while (true) {
    const { data } = await supabase.from("inspections").select("id").limit(500);
    if (data === null || data.length === 0) break;
    await supabase.from("inspections").delete().in("id", data.map(r => r.id));
    console.log("Deleted " + data.length + " inspections");
  }
  // Delete properties
  while (true) {
    const { data } = await supabase.from("inspection_properties").select("id").limit(500);
    if (data === null || data.length === 0) break;
    await supabase.from("inspection_properties").delete().in("id", data.map(r => r.id));
    console.log("Deleted " + data.length + " properties");
  }
  const { count: c1 } = await supabase.from("inspection_properties").select("id", { count: "exact", head: true });
  const { count: c2 } = await supabase.from("inspections").select("id", { count: "exact", head: true });
  console.log("Clean slate: properties=" + c1 + " inspections=" + c2);
}

main();
