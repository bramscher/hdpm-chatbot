/**
 * Balance overdue inspections across upcoming months
 *
 * Capacity: 45/week = ~180/month
 * Strategy: Spread overdue (due today) across the next 6 months
 *           with heavier loading in the first 2 months
 *           Then set each property's second inspection to first + 6 months
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const today = new Date().toISOString().split("T")[0];

  // Get all inspections grouped by property
  const { data: allInspections } = await supabase
    .from("inspections")
    .select("id, due_date, property_id")
    .order("due_date");

  // Group by property
  const byProp = {};
  allInspections.forEach(d => {
    if (!byProp[d.property_id]) byProp[d.property_id] = [];
    byProp[d.property_id].push(d);
  });

  // Sort each property's inspections by date
  Object.values(byProp).forEach(arr => arr.sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "")));

  // Find properties whose FIRST inspection is due today (overdue/backlog)
  const overdueProperties = [];
  for (const [propId, inspections] of Object.entries(byProp)) {
    if (inspections[0] && inspections[0].due_date === today) {
      overdueProperties.push({
        propId,
        firstInsp: inspections[0],
        secondInsp: inspections[1] || null,
      });
    }
  }

  console.log(`Found ${overdueProperties.length} properties with first inspection due today`);
  console.log(`Capacity: 45/week = ~180/month`);

  // Spread across April - August 2026 (5 months)
  // April: heavier (80), May: 80, June: 80, July: 80, Aug: 80+
  // Actually at 45/week for 22 weeks (Apr-Aug) = 990 capacity, plenty for 409

  // Generate weekday dates from April 1 to August 31
  const startDate = new Date("2026-04-01T12:00:00");
  const endDate = new Date("2026-08-31T12:00:00");
  const weekdays = [];
  const d = new Date(startDate);
  while (d <= endDate) {
    const day = d.getDay();
    if (day >= 1 && day <= 5) { // Monday-Friday
      weekdays.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }

  console.log(`Available weekdays Apr-Aug: ${weekdays.length}`);

  // Distribute: ~3 inspections per weekday (409 / ~110 weekdays ≈ 3.7)
  // Front-load slightly: April gets more
  const aprilDays = weekdays.filter(d => d.getMonth() === 3); // April = 3
  const mayDays = weekdays.filter(d => d.getMonth() === 4);
  const juneDays = weekdays.filter(d => d.getMonth() === 5);
  const julyDays = weekdays.filter(d => d.getMonth() === 6);
  const augDays = weekdays.filter(d => d.getMonth() === 7);

  console.log(`\nWeekdays: Apr=${aprilDays.length}, May=${mayDays.length}, Jun=${juneDays.length}, Jul=${julyDays.length}, Aug=${augDays.length}`);

  // Assign inspections to dates, cycling through weekdays
  // Weight: April 4/day, May 4/day, June 3/day, July 3/day, Aug 3/day
  const schedule = [];

  // Build weighted day pool
  const dayPool = [];
  aprilDays.forEach(d => { for (let i = 0; i < 4; i++) dayPool.push(d); });
  mayDays.forEach(d => { for (let i = 0; i < 4; i++) dayPool.push(d); });
  juneDays.forEach(d => { for (let i = 0; i < 3; i++) dayPool.push(d); });
  julyDays.forEach(d => { for (let i = 0; i < 3; i++) dayPool.push(d); });
  augDays.forEach(d => { for (let i = 0; i < 3; i++) dayPool.push(d); });

  // Shuffle the overdue properties for randomness
  overdueProperties.sort(() => Math.random() - 0.5);

  let dayIdx = 0;
  for (const prop of overdueProperties) {
    const assignedDay = dayPool[dayIdx % dayPool.length];
    const firstDate = assignedDay.toISOString().split("T")[0];

    // Second inspection = first + 6 months
    const secondDay = new Date(assignedDay);
    secondDay.setMonth(secondDay.getMonth() + 6);
    const secondDate = secondDay.toISOString().split("T")[0];

    schedule.push({
      firstInspId: prop.firstInsp.id,
      firstDate,
      secondInspId: prop.secondInsp ? prop.secondInsp.id : null,
      secondDate,
    });

    dayIdx++;
  }

  // Show distribution
  const monthCount = {};
  schedule.forEach(s => {
    const m1 = s.firstDate.substring(0, 7);
    monthCount[m1] = (monthCount[m1] || 0) + 1;
    if (s.secondInspId) {
      const m2 = s.secondDate.substring(0, 7);
      monthCount[m2] = (monthCount[m2] || 0) + 1;
    }
  });

  console.log("\nProposed distribution (first + second):");
  Object.keys(monthCount).sort().forEach(m => {
    const perWeek = Math.round(monthCount[m] / 4.3);
    console.log(`  ${m}: ${monthCount[m]} inspections (~${perWeek}/week)`);
  });

  // Apply updates
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("\n[DRY RUN] No changes made. Run without --dry-run to apply.");
    return;
  }

  console.log("\nApplying updates...");
  let updated = 0;
  let errors = 0;

  for (const s of schedule) {
    // Update first inspection
    const { error: e1 } = await supabase
      .from("inspections")
      .update({ due_date: s.firstDate })
      .eq("id", s.firstInspId);
    if (e1) { errors++; } else { updated++; }

    // Update second inspection
    if (s.secondInspId) {
      const { error: e2 } = await supabase
        .from("inspections")
        .update({ due_date: s.secondDate })
        .eq("id", s.secondInspId);
      if (e2) { errors++; } else { updated++; }
    }
  }

  console.log(`Updated: ${updated}, Errors: ${errors}`);

  // Final verification
  const { data: verify } = await supabase.from("inspections").select("due_date");
  const verifyByMonth = {};
  verify.forEach(d => { const m = d.due_date?.substring(0,7); verifyByMonth[m] = (verifyByMonth[m]||0)+1; });
  console.log("\nFinal distribution:");
  Object.keys(verifyByMonth).sort().forEach(m => {
    const perWeek = Math.round(verifyByMonth[m] / 4.3);
    console.log(`  ${m}: ${verifyByMonth[m]} (~${perWeek}/week)`);
  });
}

main().catch(console.error);
