import { NextRequest, NextResponse } from 'next/server';

const AI_LEASING_PHONE = '(541) 406-6409';

interface UnitInput {
  appfolio_unit_id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  bedrooms: number;
  bathrooms: number;
  rent: number;
  sqft: number;
  available_date: string;
  unit_type: string;
  amenities: string[];
  marketing_description: string;
}

interface GenerateRequest {
  unit: UnitInput;
  rently_enabled: boolean;
  rently_url: string;
}

function generateTitle(unit: UnitInput): string {
  const city = unit.city || 'Central Oregon';
  const type = unit.unit_type || 'Rental';
  const bed = unit.bedrooms;
  const bath = unit.bathrooms;

  const hasGarage = unit.amenities.some(
    (a) => a.toLowerCase().includes('garage')
  );

  const garageSuffix = hasGarage ? ', Garage' : '';
  const address = unit.address;

  return `${city} ${type} – ${bed}BR/${bath}BA${garageSuffix} - ${address}`;
}

/**
 * Parse the AppFolio marketing description into structured sections.
 * Typical format:
 *   Optional intro paragraph(s)
 *   APPLY NOW:
 *   * bullet point features
 *   *** Rental Agreement Type ***
 *   Boilerplate disclaimers...
 */
function parseDescription(raw: string): { intro: string; bullets: string[]; agreementType: string } {
  const text = raw.replace(/\r\n/g, '\n').trim();
  const lines = text.split('\n');

  const intro: string[] = [];
  const bullets: string[] = [];
  let agreementType = 'Month-to-Month Rental Agreement';
  let inBullets = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip "APPLY NOW:" / "APPLY ONLINE:" lines and bare apply URLs
    if (/^APPLY\s+(NOW|ONLINE)\s*:/i.test(trimmed)) {
      inBullets = true;
      continue;
    }
    if (/^https?:\/\/(www\.)?rentzap\.com/i.test(trimmed)) {
      continue;
    }

    // Capture rental agreement type from *** ... *** line
    const agreementMatch = trimmed.match(/^\*{2,}\s*(.+?)\s*\*{2,}$/);
    if (agreementMatch) {
      agreementType = agreementMatch[1].trim();
      break; // Everything after this is boilerplate disclaimers we handle ourselves
    }

    // Bullet line (starts with *)
    if (/^\*\s+/.test(trimmed)) {
      inBullets = true;
      bullets.push(trimmed.replace(/^\*\s+/, '').trim());
      continue;
    }

    // Before bullets started — part of intro
    if (!inBullets && trimmed) {
      intro.push(trimmed);
    }
  }

  return { intro: intro.join('\n'), bullets, agreementType };
}

/**
 * Format the human-written marketing description from AppFolio into
 * Craigslist-compatible HTML with HDPM branding and standard blocks.
 * All copy is verbatim from AppFolio — only HTML structure is added.
 */
function formatListing(unit: UnitInput, rentlyEnabled: boolean, rentlyUrl: string): string {
  const rentlyBlock = rentlyEnabled
    ? `
<hr>
<h2 style="text-align:center; color:#2c4a29;">🔑 Tour On Your Schedule</h2>
<p style="text-align:center;">No office visit or key pickup required.<br>Self-guided tours available <b>7 days a week</b> including evenings and weekends.</p>
<p style="text-align:center;"><a href="${rentlyUrl}">Schedule Your Rently Tour →</a></p>
`
    : '';

  const { intro, bullets, agreementType } = parseDescription(unit.marketing_description);

  // Build the "About This Home" section from intro paragraph(s)
  const introHtml = intro
    ? `<h2 style="color:#2c4a29;">About This Home</h2>
<p>${intro.replace(/\n/g, '<br>')}</p>`
    : '';

  // Build the "Features & Amenities" bullet list
  const bulletsHtml = bullets.length > 0
    ? `<h2 style="color:#2c4a29;">Features &amp; Amenities</h2>
<ul>
${bullets.map((b) => `<li>${b}</li>`).join('\n')}
</ul>`
    : '';

  return `<table style="width:100%; border:1px solid #ddd; border-collapse:collapse;">
<tr>
<td style="padding:8px; text-align:center; border:1px solid #ddd;"><b>Rent</b><br>$${unit.rent.toLocaleString()}/mo</td>
<td style="padding:8px; text-align:center; border:1px solid #ddd;"><b>Beds</b><br>${unit.bedrooms}</td>
<td style="padding:8px; text-align:center; border:1px solid #ddd;"><b>Baths</b><br>${unit.bathrooms}</td>
${unit.sqft ? `<td style="padding:8px; text-align:center; border:1px solid #ddd;"><b>Sq Ft</b><br>${unit.sqft.toLocaleString()}</td>` : ''}
<td style="padding:8px; text-align:center; border:1px solid #ddd;"><b>Available</b><br>${unit.available_date || 'Contact us'}</td>
</tr>
</table>

${introHtml ? `<hr>\n${introHtml}\n` : ''}
${bulletsHtml ? `<hr>\n${bulletsHtml}\n` : ''}
<hr>
<h2 style="text-align:center; color:#2c4a29;">Ready to Make This Home Yours?</h2>
<p style="text-align:center; font-size:18px; padding:12px; border:2px solid #2c4a29; background-color:#f0f7ef;"><a href="https://www.rentzap.com/apply/${unit.appfolio_unit_id}" style="color:#2c4a29;"><b>✅ Apply Online Now →</b></a></p>

<hr>
<h2 style="text-align:center; color:#2c4a29;">📞 Questions? We're Available 24/7</h2>
<p style="text-align:center;">Our AI leasing agent Leesa is ready to help any time — no office hours, no waiting.</p>
<p style="text-align:center;">
<b>Call or text:</b> ${AI_LEASING_PHONE}<br>
<b>Chat online:</b> <a href="https://www.highdesertpm.com">www.highdesertpm.com</a>
</p>
${rentlyBlock}
<hr>
<p style="text-align:center; font-size:12px; color:#888;">
${agreementType}<br><br>
Availability date is approximate, in case of unforeseen circumstances.<br>
Security deposit listed is the base amount. Deposits are adjusted, if necessary, depending on your application screening.<br><br>
All information is deemed accurate and reliable but should be independently verified.
</p>
<p style="text-align:center; font-size:12px; color:#888;">
<b>High Desert Property Management</b><br>
1515 SW Reindeer Ave · Redmond, Oregon 97756<br>
<a href="https://www.highdesertpm.com">www.highdesertpm.com</a>
</p>`;
}

export async function POST(req: NextRequest) {
  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { unit, rently_enabled, rently_url } = body;

  if (!unit || !unit.appfolio_unit_id) {
    return NextResponse.json({ error: 'Unit data required' }, { status: 400 });
  }

  if (!unit.marketing_description?.trim()) {
    return NextResponse.json(
      { error: 'No marketing description found in AppFolio for this unit. Please add one in AppFolio first.' },
      { status: 400 }
    );
  }

  const title = generateTitle(unit);
  const listingBody = formatListing(unit, rently_enabled, rently_url);

  return NextResponse.json({ title, body: listingBody });
}
