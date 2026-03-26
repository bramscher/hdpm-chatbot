/**
 * Spread overdue inspections across the next 6 months.
 *
 * Capacity: 45 inspections/week (15 stops x 3 inspectors)
 * Strategy: Surge in April (50/week), then steady at 45/week
 * Second inspection = first + 6 months
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Get all inspections grouped by property
  const { data: allInsps } = await supabase
    .from("inspections")
    .select("id, property_id, due_date, status, inspection_type")
    .order("due_date");

  // Group by property
  const byProp = {};
  allInsps.forEach((i) => {
    if (!byProp[i.property_id]) byProp[i.property_id] = [];
    byProp[i.property_id].push(i);
  });

  // Sort each property's inspections by due_date
  Object.values(byProp).forEach((arr) =>
    arr.sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
  );

  // Find first-round inspections that are due today or in the past
  const firstRoundOverdue = [];
  for (const [propId, insps] of Object.entries(byProp)) {
    const first = insps[0];
    if (first && first.due_date <= todayStr) {
      firstRoundOverdue.push({ ...first, second: insps[1] || null });
    }
  }

  console.log("Total properties:", Object.keys(byProp).length);
  console.log("First-round overdue/due-today:", firstRoundOverdue.length);
  console.log("Already future (no change needed):", Object.keys(byProp).length - firstRoundOverdue.length);

  if (firstRoundOverdue.length === 0) {
    console.log("Nothing to spread!");
    return;
  }

  // Generate weekly slots starting next Monday
  // April: 50/week (surge), May-Aug: 45/week (steady)
  const slots = [];
  const startDate = new Date(today);
  // Move to next Monday
  const dayOfWeek = startDate.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  startDate.setDate(startDate.getDate() + daysToMonday);

  // Generate 26 weeks of slots (6 months)
  for (let week = 0; week < 26; week++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + week * 7);
    const month = weekStart.getMonth(); // 0-indexed

    // April (month 3) = 50/week surge, rest = 45/week
    const capacity = month === 3 ? 50 : 45;

    // Spread inspections across Mon-Fri of this week
    for (let day = 0; day < 5; day++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + day);
      slots.push({
        date: d.toISOString().split("T")[0],
        capacity: Math.ceil(capacity / 5), // per day
        assigned: 0,
      });
    }
  }

  // Assign first-round inspections to slots
  let slotIdx = 0;
  const updates = [];

  for (const insp of firstRoundOverdue) {
    // Find next slot with capacity
    while (slotIdx < slots.length && slots[slotIdx].assigned >= slots[slotIdx].capacity) {
      slotIdx++;
    }
    if (slotIdx >= slots.length) {
      console.log("Ran out of slots! Remaining:", firstRoundOverdue.length - updates.length);
      break;
    }

    const newDate = slots[slotIdx].date;
    slots[slotIdx].assigned++;

    // First inspection
    updates.push({ id: insp.id, due_date: newDate });

    // Second inspection = first + 6 months
    if (insp.second) {
      const secondDate = new Date(newDate + "T12:00:00");
      secondDate.setMonth(secondDate.getMonth() + 6);
      updates.push({ id: insp.second.id, due_date: secondDate.toISOString().split("T")[0] });
    }
  }

  console.log("\nUpdates to apply:", updates.length);

  // Show distribution by month
  const byMonth = {};
  updates.forEach((u) => {
    const m = u.due_date.substring(0, 7);
    byMonth[m] = (byMonth[m] || 0) + 1;
  });
  console.log("\nNew distribution by month:");
  Object.keys(byMonth)
    .sort()
    .forEach((m) => console.log("  " + m + ": " + byMonth[m]));

  // Apply updates in batches
  let applied = 0;
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    for (const u of batch) {
      const { error } = await supabase
        .from("inspections")
        .update({ due_date: u.due_date })
        .eq("id", u.id);
      if (error) {
        console.log("Error updating", u.id, ":", error.message);
      } else {
        applied++;
      }
    }
  }

  console.log("\nApplied:", applied, "updates");

  // Final verification
  const { data: verify } = await supabase
    .from("inspections")
    .select("due_date")
    .order("due_date");
  const verifyByMonth = {};
  verify.forEach((v) => {
    const m = v.due_date?.substring(0, 7);
    verifyByMonth[m] = (verifyByMonth[m] || 0) + 1;
  });
  console.log("\nFinal distribution (all inspections):");
  Object.keys(verifyByMonth)
    .sort()
    .forEach((m) => console.log("  " + m + ": " + verifyByMonth[m]));
}

main().catch(console.error);
