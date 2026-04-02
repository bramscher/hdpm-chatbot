import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const AI_LEASING_PHONE = '(541) 406-6409';
const AI_LEASING_PHONE_RAW = '+15414066409';

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
}

interface GenerateRequest {
  unit: UnitInput;
  rently_enabled: boolean;
  rently_url: string;
}

function buildSystemPrompt(unit: UnitInput, rentlyEnabled: boolean, rentlyUrl: string): string {
  const encodedAddress = encodeURIComponent(unit.address);

  const rentlyIntroNote = rentlyEnabled
    ? ' If self-guided tours are available (Rently), mention that tours are available evenings and weekends with no office visit required.'
    : '';

  const rentlyBlock = rentlyEnabled
    ? `
<hr>
<h2 style="text-align:center; color:#2c4a29;">🔑 Tour On Your Schedule</h2>
<p style="text-align:center;">No office visit or key pickup required.<br>Self-guided tours available <b>7 days a week</b> including evenings and weekends.</p>
<p style="text-align:center;"><a href="${rentlyUrl}">Schedule Your Rently Tour →</a></p>
`
    : '';

  return `You are a Craigslist listing copywriter for High Desert Property Management (HDPM), a professional property management company in Central Oregon. Generate an HTML-formatted Craigslist rental listing for the following unit.

UNIT DATA:
- Address: ${unit.address}
- City: ${unit.city}, ${unit.state} ${unit.zip}
- Type: ${unit.unit_type}
- Bedrooms: ${unit.bedrooms}
- Bathrooms: ${unit.bathrooms}
- Square Feet: ${unit.sqft || 'Not specified'}
- Monthly Rent: $${unit.rent.toLocaleString()}
- Available Date: ${unit.available_date || 'Contact for availability'}
- Amenities/Appliances: ${unit.amenities.length > 0 ? unit.amenities.join(', ') : 'Contact for details'}
- AppFolio Unit ID: ${unit.appfolio_unit_id}

CRAIGSLIST HTML RULES — only these tags are allowed (anything else gets stripped):
h2, h3, b, strong, i, em, u, p, br, hr, ul, ol, li, table, tr, td, th, a, blockquote
Inline style attribute works for: color, font-size, text-align, margin, padding, border
NO div, span, h1, img, or class/id attributes.

INSTRUCTIONS:

1. Start with a quick-glance summary table at the top:

<table style="width:100%; border:1px solid #ddd; border-collapse:collapse;">
<tr>
<td style="padding:8px; text-align:center; border:1px solid #ddd;"><b>Rent</b><br>$${unit.rent.toLocaleString()}/mo</td>
<td style="padding:8px; text-align:center; border:1px solid #ddd;"><b>Beds</b><br>${unit.bedrooms}</td>
<td style="padding:8px; text-align:center; border:1px solid #ddd;"><b>Baths</b><br>${unit.bathrooms}</td>
${unit.sqft ? `<td style="padding:8px; text-align:center; border:1px solid #ddd;"><b>Sq Ft</b><br>${unit.sqft.toLocaleString()}</td>` : ''}
<td style="padding:8px; text-align:center; border:1px solid #ddd;"><b>Available</b><br>${unit.available_date || 'Contact us'}</td>
</tr>
</table>

Include that table exactly as shown above. Do not modify it.

2. After the table, write a <h2> section header "About This Home" followed by a 2-3 sentence neighborhood intro in a <p> tag. Mention a specific neighborhood landmark or cross-street if you can infer one from the address. Naturally work in that our 24/7 AI leasing agent is available any time as a convenience differentiator.${rentlyIntroNote}

3. Write a <h2> section header "Features & Amenities" followed by a <ul> list of all unit features. Bold key selling points with <b> tags. Always highlight included utilities (water/sewer, landscape maintenance) as cost-saving benefits. Call out energy efficiency features prominently if present. Include appliances, garage/parking, smoking policy, and any other relevant features.

4. Include this exact apply block after the features (do not modify it):

<hr>
<h2 style="text-align:center; color:#2c4a29;">Ready to Make This Home Yours?</h2>
<p style="text-align:center; font-size:18px;"><a href="https://www.rentzap.com/apply/${unit.appfolio_unit_id}"><b>✅ Apply Now →</b></a></p>

5. Include this exact contact block (do not modify it):

<hr>
<h2 style="text-align:center; color:#2c4a29;">📞 Questions? We're Available 24/7</h2>
<p style="text-align:center;">Our AI leasing agent is ready to help any time — no office hours, no waiting.</p>
<p style="text-align:center;">
<b>Call or text:</b> <a href="tel:${AI_LEASING_PHONE_RAW}">${AI_LEASING_PHONE}</a><br>
<b>Text about this home:</b> <a href="sms:${AI_LEASING_PHONE_RAW}?body=I%20am%20interested%20in%20%3C${encodedAddress}%3E">Send a text →</a><br>
<b>Chat online:</b> <a href="https://www.highdesertpm.com">www.highdesertpm.com</a>
</p>
${rentlyBlock}
6. Close with this exact block (do not modify it):

<hr>
<p style="text-align:center; font-size:12px; color:#888;">
Animals Considered (maximum 2); additional monthly animal rent applies.<br>
Month-to-Month Rental Agreement<br><br>
Availability date is approximate, in case of unforeseen circumstances.<br>
Deposits are adjusted, if necessary, depending on your application screening.<br>
All information is deemed accurate and reliable but should be independently verified.
</p>
<p style="text-align:center; font-size:12px; color:#888;">
<b>High Desert Property Management</b><br>
1515 SW Reindeer Ave · Redmond, Oregon 97756<br>
<a href="https://www.highdesertpm.com">www.highdesertpm.com</a>
</p>

OUTPUT FORMAT:
- Output valid HTML using only the allowed Craigslist tags listed above.
- Use <h2> for section headers with style="color:#2c4a29;" for the HDPM brand green.
- Use <hr> between major sections for clean visual separation.
- Do NOT include a title — I will generate the title separately.
- Do NOT wrap everything in <html>, <head>, or <body> tags. Just the body content.
- Start directly with the summary table.`;
}

function generateTitle(unit: UnitInput): string {
  const city = unit.city || 'Central Oregon';
  const type = unit.unit_type || 'Rental';
  const bed = unit.bedrooms;
  const bath = unit.bathrooms;

  // Check for garage in amenities
  const hasGarage = unit.amenities.some(
    (a) => a.toLowerCase().includes('garage')
  );

  const garageSuffix = hasGarage ? ', Garage' : '';
  const address = unit.address;

  return `${city} ${type} – ${bed}BR/${bath}BA${garageSuffix} - ${address}`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'CLAUDE_API_KEY not configured' },
      { status: 500 }
    );
  }

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

  try {
    const anthropic = new Anthropic({ apiKey });

    const systemPrompt = buildSystemPrompt(unit, rently_enabled, rently_url);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Generate the Craigslist listing body for ${unit.address}, ${unit.city}. Follow the system instructions exactly.`,
        },
      ],
      system: systemPrompt,
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    const listingBody = textBlock?.text || '';

    const title = generateTitle(unit);

    return NextResponse.json({ title, body: listingBody });
  } catch (err) {
    console.error('[generate-listing] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate listing' },
      { status: 500 }
    );
  }
}
