import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  getMultitenantId,
  createMeld,
  addMeldMessage,
  getResidentsForUnit,
} from '@/lib/property-meld';

/**
 * POST /api/inspections/notify
 *
 * Automated inspection notice system. Checks for upcoming scheduled inspections
 * and sends notifications via Property Meld:
 *   - 7 days before: Creates a meld (notifies tenant)
 *   - 24 hours before: Adds reminder message to the meld
 *   - 2 hours before: Adds final reminder message to the meld
 *
 * Designed to be called by a Vercel cron job every hour.
 * Also callable manually via POST for testing.
 *
 * Query params:
 *   ?mode=dry_run  — logs what would happen, no PM calls, no DB writes
 *   ?mode=silent   — creates melds & messages but hidden from tenants (test in PM without notifying)
 */
export async function POST(request: NextRequest) {
  // Auth: either CRON_SECRET header or valid session
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mode = request.nextUrl.searchParams.get('mode') || 'live';
  const isDryRun = mode === 'dry_run';
  const isSilent = mode === 'silent';

  const supabase = getSupabaseAdmin();
  const now = new Date();

  const results = {
    mode,
    checked: 0,
    notice_7d_created: 0,
    notice_24h_sent: 0,
    notice_2h_sent: 0,
    actions: [] as string[],
    errors: [] as string[],
  };

  try {
    // Find all scheduled inspections with a target_date in the next 8 days
    // that still have outstanding notices to send
    const eightDaysOut = new Date(now);
    eightDaysOut.setDate(eightDaysOut.getDate() + 8);

    const { data: inspections, error: fetchErr } = await supabase
      .from('inspections')
      .select(`
        id, target_date, inspection_type, unit_name, resident_name,
        notice_meld_id, notice_7d_sent_at, notice_24h_sent_at, notice_2h_sent_at,
        meld_id,
        inspection_properties (
          id, name, address_1, address_2, city, state, zip,
          pm_property_id, pm_unit_id
        )
      `)
      .eq('status', 'scheduled')
      .not('target_date', 'is', null)
      .lte('target_date', eightDaysOut.toISOString().split('T')[0])
      .gte('target_date', now.toISOString().split('T')[0]);

    if (fetchErr) throw new Error(`Failed to fetch inspections: ${fetchErr.message}`);
    if (!inspections || inspections.length === 0) {
      return NextResponse.json({ message: 'No inspections need notifications', ...results });
    }

    results.checked = inspections.length;

    let multitenantId: number | null = null;

    for (const inspection of inspections) {
      const targetDate = new Date(`${inspection.target_date}T09:00:00`);
      const hoursUntil = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      const rawProp = inspection.inspection_properties as unknown;
      const prop = (Array.isArray(rawProp) ? rawProp[0] : rawProp) as Record<string, unknown> | null;

      if (!prop) continue;

      const pmPropertyId = prop.pm_property_id as number | null;
      const pmUnitId = prop.pm_unit_id as number | null;

      if (!pmPropertyId && !pmUnitId) continue;

      const address = [prop.address_1, prop.address_2, prop.city].filter(Boolean).join(', ');
      const unit = inspection.unit_name ? ` (Unit ${inspection.unit_name})` : '';
      const inspType = inspection.inspection_type || 'biannual';
      const formattedDate = targetDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

      // Lazy-load multitenant ID (skip for dry run)
      if (!multitenantId && !isDryRun) {
        try {
          multitenantId = await getMultitenantId();
        } catch (err) {
          results.errors.push(`Failed to get multitenant ID: ${err instanceof Error ? err.message : String(err)}`);
          break;
        }
      }

      try {
        // ── 7-day notice: create meld ──
        if (hoursUntil <= 7 * 24 && hoursUntil > 0 && !inspection.notice_7d_sent_at) {
          const description = [
            `This is an advance notice for a scheduled ${inspType} property inspection.`,
            '',
            `Property: ${address}${unit}`,
            inspection.resident_name ? `Resident: ${inspection.resident_name}` : null,
            `Scheduled Date: ${formattedDate}`,
            '',
            'Our inspector will visit the property to conduct a routine inspection.',
            'Please ensure the property is accessible on the scheduled date.',
            '',
            'If you have any questions or need to reschedule, please reply to this message or call us at (541) 406-6409.',
            isSilent ? '\n[TEST MODE — this notice was not sent to tenants]' : null,
          ].filter((l) => l !== null).join('\n');

          if (isDryRun) {
            results.actions.push(`[DRY RUN] Would create 7-day notice meld for ${address}${unit} (inspection ${inspection.id}, ${hoursUntil.toFixed(1)}h until target)`);
          } else {
            // Look up tenant IDs for the unit
            let tenantIds: number[] = [];
            if (pmUnitId && !isSilent) {
              try {
                const residents = await getResidentsForUnit(multitenantId!, pmUnitId);
                tenantIds = residents.map((r) => r.id);
              } catch {
                // Proceed without tenant IDs — meld still gets created
              }
            }

            const meld = await createMeld(multitenantId!, {
              ...(pmUnitId ? { unit: pmUnitId } : {}),
              ...(pmPropertyId && !pmUnitId ? { property: pmPropertyId } : {}),
              // In silent mode, don't attach tenants so they don't get notified
              ...(!isSilent && tenantIds.length > 0 ? { tenants: tenantIds } : {}),
              work_location: 'Interior',
              work_type: 'PREVENTIVE_MAINTENANCE',
              work_category: 'GENERAL',
              brief_description: `${isSilent ? '[TEST] ' : ''}Upcoming ${inspType} Inspection — ${address}${unit}`,
              description,
              priority: 'LOW',
            });

            await supabase
              .from('inspections')
              .update({
                notice_meld_id: String(meld.id),
                notice_7d_sent_at: now.toISOString(),
                updated_at: now.toISOString(),
              })
              .eq('id', inspection.id);

            results.actions.push(`${isSilent ? '[SILENT] ' : ''}Created 7-day notice meld #${meld.id} for ${address}${unit}`);
          }

          results.notice_7d_created++;
        }

        // ── 24-hour reminder ──
        const noticeMeldId = inspection.notice_meld_id;
        if (hoursUntil <= 24 && hoursUntil > 0 && inspection.notice_7d_sent_at && !inspection.notice_24h_sent_at && noticeMeldId) {
          const messageText = [
            `Reminder: Your ${inspType} property inspection is scheduled for tomorrow, ${formattedDate}.`,
            '',
            `Property: ${address}${unit}`,
            '',
            'Please ensure the property is accessible. If you need to reschedule, contact us as soon as possible at (541) 406-6409.',
          ].join('\n');

          if (isDryRun) {
            results.actions.push(`[DRY RUN] Would send 24h reminder on meld #${noticeMeldId} for ${address}${unit}`);
          } else {
            await addMeldMessage(
              multitenantId!,
              parseInt(noticeMeldId, 10),
              messageText,
              isSilent ? { hidden_from_tenant: true } : undefined
            );

            await supabase
              .from('inspections')
              .update({
                notice_24h_sent_at: now.toISOString(),
                updated_at: now.toISOString(),
              })
              .eq('id', inspection.id);

            results.actions.push(`${isSilent ? '[SILENT] ' : ''}Sent 24h reminder on meld #${noticeMeldId} for ${address}${unit}`);
          }

          results.notice_24h_sent++;
        }

        // ── 2-hour reminder ──
        if (hoursUntil <= 2 && hoursUntil > 0 && inspection.notice_24h_sent_at && !inspection.notice_2h_sent_at && noticeMeldId) {
          const messageText = [
            `Final reminder: Our inspector will be arriving at ${address}${unit} shortly for your scheduled ${inspType} inspection.`,
            '',
            'Please ensure the property is accessible. Thank you!',
          ].join('\n');

          if (isDryRun) {
            results.actions.push(`[DRY RUN] Would send 2h reminder on meld #${noticeMeldId} for ${address}${unit}`);
          } else {
            await addMeldMessage(
              multitenantId!,
              parseInt(noticeMeldId, 10),
              messageText,
              isSilent ? { hidden_from_tenant: true } : undefined
            );

            await supabase
              .from('inspections')
              .update({
                notice_2h_sent_at: now.toISOString(),
                updated_at: now.toISOString(),
              })
              .eq('id', inspection.id);

            results.actions.push(`${isSilent ? '[SILENT] ' : ''}Sent 2h reminder on meld #${noticeMeldId} for ${address}${unit}`);
          }

          results.notice_2h_sent++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(`Inspection ${inspection.id} (${address}): ${msg}`);
      }
    }

    return NextResponse.json({
      message: 'Notification check complete',
      ...results,
    });
  } catch (err) {
    console.error('[inspections/notify] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Notification check failed' },
      { status: 500 }
    );
  }
}

// GET for easy browser testing / status check
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/inspections/notify',
    description: 'Automated inspection notice system',
    schedule: 'Runs every hour via Vercel cron',
    notices: [
      '7 days before: Creates Property Meld with tenant notification',
      '24 hours before: Sends reminder message on the meld',
      '2 hours before: Sends final reminder message on the meld',
    ],
    test_modes: {
      dry_run: 'POST ?mode=dry_run — logs what would happen, no API calls, no DB writes',
      silent: 'POST ?mode=silent — creates melds & messages in PM but hidden from tenants',
      live: 'POST (default) — full production mode, tenants are notified',
    },
  });
}
