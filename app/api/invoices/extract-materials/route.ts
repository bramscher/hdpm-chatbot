import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Anthropic from '@anthropic-ai/sdk';

function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY or CLAUDE_API_KEY environment variable is not set');
  }
  return new Anthropic({ apiKey });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email?.endsWith('@highdesertpm.com')) {
      console.log('[extract-materials] Unauthorized request');
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in with your company Microsoft account.' },
        { status: 401 }
      );
    }

    const { description } = await request.json();
    console.log(`[extract-materials] Input (${description?.length || 0} chars): ${description?.substring(0, 200)}`);

    if (!description?.trim()) {
      return NextResponse.json({ materials: [], laborDescription: '' });
    }

    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `You are parsing a property maintenance work order description for an invoice system. Separate the description into LABOR (services/tasks performed) and MATERIALS (physical parts, supplies, appliances, fixtures purchased/used).

RULES:
- Each line or item in the description is either a labor task OR a material.
- Physical items, appliances, parts, fixtures, supplies = MATERIALS. Examples: "GE 30-in Electric Range", "6 FT 50 Amp Range Cord", "faucet cartridge", "door stop", "smoke detector", "toilet flapper", "fill valve", "light bulb", "air filter", "P-trap", "garbage disposal", "caulk", "paint", "drywall patch"
- Service tasks like "Haul Away", "Install", "Replace", "Repair", "Diagnose", "Clean", "Inspect" = LABOR
- If a line is like "Replace faucet cartridge" — "Replace" is labor, "Faucet cartridge" is the material. Split them.
- If a line is purely a product name/model (e.g. "GE 30-in 4 Burners Electric Range White") — that's a material.

Return a JSON object with:
{
  "materials": [
    { "description": "material name", "amount": "cost if mentioned, otherwise 0" }
  ],
  "laborDescription": "remaining labor/task descriptions combined, or empty string if none"
}

Return ONLY valid JSON, no other text.

Work Order Description:
${description.trim()}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      console.log('[extract-materials] Non-text response from AI');
      return NextResponse.json({ materials: [], laborDescription: '' });
    }

    console.log(`[extract-materials] AI response: ${content.text.substring(0, 500)}`);

    let jsonStr = content.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const materials = Array.isArray(parsed.materials) ? parsed.materials : [];
      const laborDescription = typeof parsed.laborDescription === 'string' ? parsed.laborDescription : '';
      console.log(`[extract-materials] Found ${materials.length} materials, labor: "${laborDescription.substring(0, 100)}"`);
      return NextResponse.json({ materials, laborDescription });
    } catch (parseErr) {
      console.error('[extract-materials] JSON parse error:', parseErr, 'Raw:', jsonStr.substring(0, 200));
      return NextResponse.json({ materials: [], laborDescription: '' });
    }
  } catch (error) {
    console.error('[extract-materials] Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[extract-materials] Stack:', stack);
    return NextResponse.json({ error: message, detail: stack?.substring(0, 500) }, { status: 500 });
  }
}
