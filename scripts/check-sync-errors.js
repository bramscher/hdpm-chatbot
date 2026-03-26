// Check what's causing the 382 sync errors
// This directly runs the sync logic pieces to identify the problem

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Check for duplicate pm_property_id + pm_unit_id combinations
  const { data: props } = await supabase
    .from("inspection_properties")
    .select("id, pm_property_id, pm_unit_id, address_1, last_inspection_date, move_in_date")
    .order("pm_property_id");

  console.log("Total properties:", props.length);

  // Check for properties with null pm_property_id
  const nopm = props.filter(p => !p.pm_property_id);
  console.log("Properties without pm_property_id:", nopm.length);

  // Check for duplicate keys
  const keyCount = {};
  for (const p of props) {
    const key = `${p.pm_property_id}-${p.pm_unit_id || ''}`;
    keyCount[key] = (keyCount[key] || 0) + 1;
  }
  const dupes = Object.entries(keyCount).filter(([, c]) => c > 1);
  console.log("Duplicate PM keys:", dupes.length);
  if (dupes.length > 0) {
    console.log("Sample duplicates:");
    dupes.slice(0, 5).forEach(([key, count]) => console.log("  " + key + ": " + count + "x"));
  }

  // Check inspections per property
  const { data: inspections } = await supabase
    .from("inspections")
    .select("id, property_id, due_date, status");

  console.log("\nTotal inspections:", inspections.length);

  // Check for properties with more than 2 inspections
  const inspPerProp = {};
  for (const i of inspections) {
    inspPerProp[i.property_id] = (inspPerProp[i.property_id] || 0) + 1;
  }
  const overTwo = Object.entries(inspPerProp).filter(([, c]) => c > 2);
  console.log("Properties with >2 inspections:", overTwo.length);

  // Check date distributions
  const withLastInsp = props.filter(p => p.last_inspection_date);
  const withMoveIn = props.filter(p => p.move_in_date);
  const withNeither = props.filter(p => !p.last_inspection_date && !p.move_in_date);
  console.log("\nDate coverage:");
  console.log("  Has last_inspection_date:", withLastInsp.length);
  console.log("  Has move_in_date:", withMoveIn.length);
  console.log("  Has neither:", withNeither.length);

  // The 382 errors are likely from creating inspections for properties that already exist
  // (re-sync on existing data). Let's check if the sync creates dupes
  const { data: existing } = await supabase
    .from("inspection_properties")
    .select("pm_property_id, pm_unit_id")
    .not("pm_property_id", "is", null);

  const existingKeys = new Set(existing.map(e => `${e.pm_property_id}-${e.pm_unit_id || ''}`));
  console.log("\nExisting PM property keys:", existingKeys.size);
  console.log("If re-syncing, these would be 'updated' not 'created'");
  console.log("382 errors likely = properties_updated (existing) that tried to create inspections again");
}

main().catch(console.error);
