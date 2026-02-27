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
            text: 'Extract ALL text content from this work order document exactly as it appears, including every section, table, and field. Pay special attention to the Details table (Account, Statement Description, Amount) and include every row.',
          },
        ],
      },
    ],
  });

  const textContent = response.content[0];
  if (textContent.type === 'text') return textContent.text;
  throw new Error('Unexpected response format from Claude Vision');
}

interface ParsedWorkOrder {
  wo_number: string;
  status: string;
  property_name: string;
  property_address: string;
  unit: string;
  description: string;
  completed_date: string;
  scheduled_date: string;
  created_date: string;
  category: string;
  assigned_to: string;
  technician: string;
  permission_to_enter: string;
  maintenance_limit: string;
  vendor_instructions: string;
  property_notes: string;
  line_items: Array<{
    account: string;
    description: string;
    amount: string;
  }>;
  total_amount: string;
  labor_amount: string;
  materials_amount: string;
}

async function extractWorkOrderFields(text: string): Promise<ParsedWorkOrder> {
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are parsing an AppFolio work order PDF for a property management company. Extract ALL fields into structured JSON. Return ONLY valid JSON, no other text.

IMPORTANT: This work order has a "Details" table (usually on page 2) with columns: Account, Statement Description, Amount. Each row is a billable line item. Extract EVERY row as a separate line item.

Return this exact JSON structure:
{
  "wo_number": "work order number (e.g. 40895-1)",
  "status": "work order status (e.g. Scheduled, Completed, Open)",
  "property_name": "property/complex name from the Job Site field",
  "property_address": "full street address with city, state, zip from Job Site",
  "unit": "unit number if applicable",
  "description": "combine the Description section into a clean summary of work performed — keep all detail about what was done but remove internal chatter",
  "completed_date": "YYYY-MM-DD format or empty string",
  "scheduled_date": "YYYY-MM-DD format or empty string",
  "created_date": "YYYY-MM-DD format or empty string",
  "category": "work category inferred from the Description and Account (e.g. locks & keys, plumbing, electrical, HVAC, general maintenance, appliance, cleaning, painting)",
  "assigned_to": "assigned user(s) or empty string",
  "technician": "Created By name or empty string",
  "permission_to_enter": "permission to enter value (e.g. N/A, Yes, No)",
  "maintenance_limit": "dollar amount as string (e.g. 200.00) or empty string",
  "vendor_instructions": "vendor instructions text or empty string",
  "property_notes": "property notes text or empty string",
  "line_items": [
    {
      "account": "GL account (e.g. 6500: Keys, Locks, Remotes, & Batteries)",
      "description": "statement description from the Details table row",
      "amount": "amount as number string, no $ sign (e.g. 90.50)"
    }
  ],
  "total_amount": "total from the Details table, no $ sign",
  "labor_amount": "labor cost if separately listed, or empty string",
  "materials_amount": "materials cost if separately listed, or empty string"
}

Rules:
- line_items MUST contain every row from the Details table. If no Details table exists, use an empty array [].
- For the property_name, use the complex/property name (e.g. "23rd St Complex - 23rd St") not the management company name.
- For the property_address, use the actual street address of the Job Site (e.g. "2800 SW 23rd St #9, Redmond, OR 97756").
- For amounts, use numbers only, no $ signs.
- Use empty string "" for any field not found.

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
    const parsed = await extractWorkOrderFields(extractedText);
    console.log(`[WO-PDF] Extracted: WO#${parsed.wo_number}, ${parsed.line_items?.length || 0} line items, total=${parsed.total_amount}`);

    // Convert to flat fields map for backward compat + include structured data
    const fields: Record<string, unknown> = {
      wo_number: parsed.wo_number,
      status: parsed.status,
      property_name: parsed.property_name,
      property_address: parsed.property_address,
      unit: parsed.unit,
      description: parsed.description,
      completed_date: parsed.completed_date,
      scheduled_date: parsed.scheduled_date,
      created_date: parsed.created_date,
      category: parsed.category,
      assigned_to: parsed.assigned_to,
      technician: parsed.technician,
      permission_to_enter: parsed.permission_to_enter,
      maintenance_limit: parsed.maintenance_limit,
      vendor_instructions: parsed.vendor_instructions,
      property_notes: parsed.property_notes,
      labor_amount: parsed.labor_amount,
      materials_amount: parsed.materials_amount,
      total_amount: parsed.total_amount,
      line_items: parsed.line_items || [],
    };

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
