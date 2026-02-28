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
    console.log(`[extract-materials] Input description (${description?.length || 0} chars): ${description?.substring(0, 200)}`);

    if (!description?.trim()) {
      console.log('[extract-materials] Empty description, returning []');
      return NextResponse.json({ materials: [] });
    }

    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `You are parsing a property maintenance work order description to extract materials, parts, and supplies that would be used for the work described.

IMPORTANT: Extract materials that are MENTIONED or IMPLIED by the tasks. For example:
- "Replace faucet" → material: "Faucet"
- "Install new door stop in bathroom" → material: "Door stop"
- "Replace toilet flapper and fill valve" → materials: "Toilet flapper", "Fill valve"
- "Fix leaking P-trap under kitchen sink" → material: "P-trap" (if replacement is implied)
- "Replace smoke detector batteries" → material: "Smoke detector batteries"
- "Install new outlet cover" → material: "Outlet cover"
- "Replace air filter" → material: "Air filter"
- "Patch drywall in bedroom" → material: "Drywall patch kit"
- "Touch up paint in living room" → material: "Paint"

Look for ANY physical items, parts, fixtures, or supplies referenced in the text. Each distinct material should be its own entry.

Return a JSON array. Each item should have:
- "description": the material/part name (capitalize first letter, be specific)
- "amount": cost as a number string if mentioned in the text, otherwise "0"

If the description is purely about inspection, diagnosis, or cleaning with no parts needed, return [].

Return ONLY the JSON array, no other text.

Work Order Description:
${description.trim()}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      console.log('[extract-materials] Non-text response from AI');
      return NextResponse.json({ materials: [] });
    }

    console.log(`[extract-materials] AI response: ${content.text.substring(0, 300)}`);

    let jsonStr = content.text.trim();
    // Handle markdown code blocks
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const materials = JSON.parse(jsonStr);
      if (!Array.isArray(materials)) {
        console.log('[extract-materials] Response is not an array');
        return NextResponse.json({ materials: [] });
      }
      console.log(`[extract-materials] Extracted ${materials.length} materials:`, materials);
      return NextResponse.json({ materials });
    } catch (parseErr) {
      console.error('[extract-materials] JSON parse error:', parseErr, 'Raw:', jsonStr);
      return NextResponse.json({ materials: [] });
    }
  } catch (error) {
    console.error('[extract-materials] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to extract materials';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
