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
 *
 * Craigslist's description sanitizer strips <table>, <div>, <span>, <hr>,
 * <h1>-<h6>, class=, and style= attributes entirely — anything with those
 * ends up as literal text in the post. We only use tags on the allowlist:
 *   <p> <br> <b> <i> <em> <strong> <u> <ul> <ol> <li> <a> <small> <blockquote>
 */
function formatListing(unit: UnitInput, rentlyEnabled: boolean, rentlyUrl: string): string {
  const rentlyBlock = rentlyEnabled
    ? `
<p><b>Tour On Your Schedule</b><br>
No office visit or key pickup required. Self-guided tours available <b>7 days a week</b> including evenings and weekends.<br>
<a href="${rentlyUrl}">Schedule Your Rently Tour</a></p>
`
    : '';

  const { intro, bullets, agreementType } = parseDescription(unit.marketing_description);

  const introHtml = intro
    ? `<p><b>About This Home</b></p>
<p>${intro.replace(/\n/g, '<br>')}</p>`
    : '';

  const bulletsHtml = bullets.length > 0
    ? `<p><b>Features &amp; Amenities</b></p>
<ul>
${bullets.map((b) => `<li>${b}</li>`).join('\n')}
</ul>`
    : '';

  // Stats line — inline pipe-separated format since tables aren't allowed.
  const statsParts = [
    `<b>Rent:</b> $${unit.rent.toLocaleString()}/mo`,
    `<b>Beds:</b> ${unit.bedrooms}`,
    `<b>Baths:</b> ${unit.bathrooms}`,
    unit.sqft ? `<b>Sq Ft:</b> ${unit.sqft.toLocaleString()}` : null,
    `<b>Available:</b> ${unit.available_date || 'Contact us'}`,
  ].filter(Boolean);

  return `<p>${statsParts.join(' &nbsp;|&nbsp; ')}</p>

${introHtml}

${bulletsHtml}

<p><b>Ready to Make This Home Yours?</b><br>
<a href="https://www.rentzap.com/apply/${unit.appfolio_unit_id}"><b>Apply Online Now</b></a></p>

<p><b>Questions? We're Available 24/7</b><br>
Our AI leasing agent Leesa is ready to help any time — no office hours, no waiting.<br>
<b>Call or text:</b> ${AI_LEASING_PHONE}<br>
<b>Chat online:</b> <a href="https://www.highdesertpm.com">www.highdesertpm.com</a></p>
${rentlyBlock}
<p><small>${agreementType}<br>
Availability date is approximate, in case of unforeseen circumstances.<br>
Security deposit listed is the base amount. Deposits are adjusted, if necessary, depending on your application screening.<br>
All information is deemed accurate and reliable but should be independently verified.</small></p>

<p><small><b>High Desert Property Management</b><br>
1515 SW Reindeer Ave &middot; Redmond, Oregon 97756<br>
<a href="https://www.highdesertpm.com">www.highdesertpm.com</a></small></p>`;
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
