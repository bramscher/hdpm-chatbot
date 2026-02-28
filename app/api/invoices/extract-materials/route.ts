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
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in with your company Microsoft account.' },
        { status: 401 }
      );
    }

    const { description } = await request.json();
    if (!description?.trim()) {
      return NextResponse.json({ materials: [] });
    }

    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `You are parsing a property maintenance work order description to extract any MATERIALS mentioned. Extract ONLY physical materials/parts/supplies — NOT labor tasks.

Return a JSON array of materials found. Each material should have:
- "description": the material name/description (e.g. "Faucet cartridge", "Door stop", "Light bulb")
- "amount": the cost as a number string if mentioned, otherwise "0"

If NO materials are mentioned, return an empty array [].

Examples of materials: faucet cartridge, door stop, light bulb, O-ring, filter, outlet cover, breaker, smoke detector, thermostat, toilet flapper, fill valve, supply line, P-trap, garbage disposal, faucet, showerhead, caulk, paint, drywall patch, etc.

Examples of NOT materials (these are labor/tasks): replace, install, fix, repair, adjust, inspect, clean, tighten, test, diagnose, etc.

Return ONLY valid JSON array, no other text.

Work Order Description:
${description.trim()}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ materials: [] });
    }

    let jsonStr = content.text.trim();
    // Handle markdown code blocks
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const materials = JSON.parse(jsonStr);
      if (!Array.isArray(materials)) {
        return NextResponse.json({ materials: [] });
      }
      return NextResponse.json({ materials });
    } catch {
      return NextResponse.json({ materials: [] });
    }
  } catch (error) {
    console.error('Extract materials error:', error);
    const message = error instanceof Error ? error.message : 'Failed to extract materials';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
