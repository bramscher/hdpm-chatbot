import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { extractText } from 'unpdf';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY or CLAUDE_API_KEY environment variable is not set');
  }
  return new Anthropic({ apiKey });
}

async function extractWithVision(arrayBuffer: ArrayBuffer): Promise<string> {
  const anthropic = getAnthropic();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: 'Extract ALL text content from this work order document exactly as it appears.',
          },
        ],
      },
    ],
  });

  const textContent = response.content[0];
  if (textContent.type === 'text') return textContent.text;
  throw new Error('Unexpected response format from Claude Vision');
}

async function extractWorkOrderFields(text: string): Promise<Record<string, string>> {
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Extract the following fields from this work order document. Return ONLY a JSON object with these keys. Use empty string "" if a field is not found. Do not include any other text.

Fields to extract:
- wo_number: The work order number/reference
- property_name: The property name
- property_address: The full property address
- unit: The unit number if applicable
- description: A clean, owner-facing summary of the work performed (remove internal notes, tenant complaints, and work order chatter - keep only the actual work description)
- completed_date: The completion date (format as YYYY-MM-DD if possible)
- category: The work category (e.g., plumbing, electrical, general maintenance)
- labor_amount: Labor cost as a number (no $ sign), or "" if not listed
- materials_amount: Materials cost as a number (no $ sign), or "" if not listed
- total_amount: Total cost as a number (no $ sign), or "" if not listed

Work Order Text:
${text}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response format');

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = content.text.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  return JSON.parse(jsonStr);
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    console.log(`[WO-PDF] Processing: ${file.name}, size: ${file.size} bytes`);

    // Step 1: Extract text from PDF
    const arrayBuffer = await file.arrayBuffer();
    const bufferCopy = arrayBuffer.slice(0);

    let extractedText = '';

    try {
      const result = await extractText(arrayBuffer);
      const fullText = Array.isArray(result.text) ? result.text.join('\n\n') : String(result.text);
      const cleanText = fullText.replace(/\s+/g, ' ').trim();

      if (cleanText.length >= 50) {
        extractedText = fullText;
        console.log(`[WO-PDF] Text extraction: ${cleanText.length} chars`);
      }
    } catch {
      console.log('[WO-PDF] Text extraction failed, using Vision');
    }

    if (!extractedText) {
      extractedText = await extractWithVision(bufferCopy);
      console.log(`[WO-PDF] Vision OCR: ${extractedText.length} chars`);
    }

    // Step 2: Use Claude to extract structured fields
    const fields = await extractWorkOrderFields(extractedText);
    console.log(`[WO-PDF] Extracted fields:`, fields);

    return NextResponse.json({
      fields,
      rawText: extractedText,
      fileName: file.name,
    });
  } catch (error) {
    console.error('WO PDF parse error:', error);
    const message = error instanceof Error ? error.message : 'Failed to parse work order PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
