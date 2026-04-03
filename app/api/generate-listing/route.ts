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
 * Format the human-written marketing description from AppFolio into
 * Craigslist-compatible HTML with HDPM branding and standard blocks.
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

  // Convert the marketing description paragraphs to HTML <p> tags
  const descriptionHtml = unit.marketing_description
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  return `<table style="width:100%; border:1px solid #ddd; border-collapse:collapse;">
<tr>
<td style="padding:8px; text-align:center; border:1px solid #ddd;"><b>Rent</b><br>$${unit.rent.toLocaleString()}/mo</td>
<td style="padding:8px; text-align:center; border:1px solid #ddd;"><b>Beds</b><br>${unit.bedrooms}</td>
<td style="padding:8px; text-align:center; border:1px solid #ddd;"><b>Baths</b><br>${unit.bathrooms}</td>
${unit.sqft ? `<td style="padding:8px; text-align:center; border:1px solid #ddd;"><b>Sq Ft</b><br>${unit.sqft.toLocaleString()}</td>` : ''}
<td style="padding:8px; text-align:center; border:1px solid #ddd;"><b>Available</b><br>${unit.available_date || 'Contact us'}</td>
</tr>
</table>

<hr>
<h2 style="color:#2c4a29;">About This Home</h2>
${descriptionHtml}

${unit.amenities.length > 0 ? `<hr>
<h2 style="color:#2c4a29;">Features &amp; Amenities</h2>
<ul>
${unit.amenities.map((a) => `<li>${a}</li>`).join('\n')}
</ul>` : ''}

<hr>
<h2 style="text-align:center; color:#2c4a29;">Ready to Make This Home Yours?</h2>
<p style="text-align:center; font-size:18px;"><a href="https://www.rentzap.com/apply/${unit.appfolio_unit_id}"><b>✅ Apply Now →</b></a></p>

<hr>
<h2 style="text-align:center; color:#2c4a29;">📞 Questions? We're Available 24/7</h2>
<p style="text-align:center;">Our AI leasing agent is ready to help any time — no office hours, no waiting.</p>
<p style="text-align:center;">
<b>Call or text:</b> ${AI_LEASING_PHONE}<br>
<b>Chat online:</b> <a href="https://www.highdesertpm.com">www.highdesertpm.com</a>
</p>
${rentlyBlock}
<hr>
<p style="text-align:center; font-size:12px; color:#888;">
Security deposit listed is the base amount. Deposits are adjusted, if necessary, depending on your application screening.<br><br>
All information is deemed accurate and reliable but should be independently verified.<br><br>
Animals Considered (maximum 2); additional monthly animal rent applies.<br>
Month-to-Month Rental Agreement<br><br>
Availability date is approximate, in case of unforeseen circumstances.
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
