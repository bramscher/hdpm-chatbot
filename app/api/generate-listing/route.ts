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
4. Include this Rently self-guided tour block immediately after the AI agent block:

────────────────────────────────
TOUR ON YOUR SCHEDULE
No office visit or key pickup required. Self-guided tours available
7 days a week including evenings and weekends.

🔑 Schedule your Rently tour: ${rentlyUrl}
────────────────────────────────
`
    : '';

  return `You are a Craigslist listing copywriter for High Desert Property Management (HDPM), a professional property management company in Central Oregon. Generate a plain-text Craigslist rental listing for the following unit.

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

INSTRUCTIONS:

1. Write a 2-3 sentence neighborhood intro paragraph. Mention a specific neighborhood landmark or cross-street if you can infer one from the address. Naturally work in that our 24/7 AI leasing agent is available any time as a convenience differentiator.${rentlyIntroNote}

2. Write a bullet list of all unit features from the data above. Each bullet should start with "- ". Always highlight included utilities (water/sewer, landscape maintenance) as cost-saving benefits. Call out energy efficiency features prominently if present. Include appliances, garage/parking, smoking policy, and any other relevant features.

3. Include this exact block after the feature bullets (do not modify it):

APPLY NOW: https://www.rentzap.com/apply/${unit.appfolio_unit_id}

────────────────────────────────
QUESTIONS? WE'RE AVAILABLE 24/7
Our AI leasing agent is ready to help any time — no office hours, no waiting.

📞 Call or text: ${AI_LEASING_PHONE}
💬 Text us about this home: sms:${AI_LEASING_PHONE_RAW}?body=I%20am%20interested%20in%20%3C${encodedAddress}%3E
🌐 Chat online: www.highdesertpm.com
────────────────────────────────
${rentlyBlock}
5. Close with this exact block (do not modify it):

Animals Considered (maximum 2); additional monthly animal rent applies.

Month-to-Month Rental Agreement

Availability date is approximate, in case of unforeseen circumstances.
Deposits are adjusted, if necessary, depending on your application screening.
All information is deemed accurate and reliable but should be independently verified.

High Desert Property Management
1515 SW Reindeer Ave
Redmond, Oregon 97756
www.highdesertpm.com

OUTPUT FORMAT:
- Plain text only. No markdown headers, no HTML, no asterisks for bold.
- Use line breaks and dashes for structure.
- Do NOT include a title — I will generate the title separately.
- Start directly with the neighborhood intro paragraph.`;
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
