import Anthropic from '@anthropic-ai/sdk';

// Lazy singleton (same pattern as lib/rag.ts)
let _anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY or CLAUDE_API_KEY environment variable is not set');
    }
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

export interface TriageInput {
  id: string;
  wo_number: string | null;
  property_name: string;
  unit_name: string | null;
  description: string;
  vendor_name: string | null;
  category: string | null;
  priority: string | null;
  appfolio_status: string | null;
  assigned_to: string | null;
  scheduled_start: string | null;
  created_at: string;
  updated_at: string;
}

export interface TriageResult {
  id: string;
  wo_number: string;
  recommendation: 'close' | 'finish' | 'migrate';
  reason: string;
}

export interface ProgressEvent {
  type: 'progress' | 'complete' | 'error';
  completed: number;
  total: number;
  batch_results?: TriageResult[];
  summary?: { close: number; finish: number; migrate: number };
  error?: string;
}

// ────────────────────────────────────────────────
// System prompt
// ────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a property management triage specialist for High Desert Property Management in Central Oregon. You are reviewing open work orders from AppFolio to classify them into one of three categories.

CATEGORIES:

1. **close** — Work orders that should be CLOSED because they are:
   - Clearly abandoned or forgotten (very old, no vendor, no recent activity)
   - Already resolved based on the description (e.g., "fixed", "complete", "resolved" in description)
   - Duplicates or irrelevant (test entries, cancelled requests)
   - Tenant has likely moved out or the issue is no longer relevant
   - Seasonal issues from a different season that are now moot
   - Very old with no vendor assigned and no schedule — nobody is working on this

2. **finish** — Work orders that should be FINISHED IN APPFOLIO because they are:
   - Nearly complete — have a vendor assigned and/or scheduled date
   - Work appears done but just needs final documentation/billing
   - Recent activity suggests the work is in progress or wrapping up
   - Has an assigned vendor who is actively working on it

3. **migrate** — Work orders that should be MIGRATED TO PROPERTY MELD because they are:
   - Active maintenance that needs ongoing tracking
   - Has a clear, unresolved maintenance need
   - Would benefit from the workflow management in Property Meld
   - Recurring or complex maintenance that needs better tracking

GUIDELINES:
- Be decisive — every work order must be classified into one of the three categories
- When in doubt between close and migrate, prefer close for orders older than 90 days with no vendor
- When in doubt between finish and migrate, prefer finish if a vendor is assigned
- Keep reasons to ONE concise sentence explaining WHY this classification was chosen
- Reference specific details from the work order in your reason (age, vendor status, description keywords)`;

// ────────────────────────────────────────────────
// Tool definition for structured output
// ────────────────────────────────────────────────

const CLASSIFY_TOOL: Anthropic.Tool = {
  name: 'classify_work_orders',
  description: 'Classify each work order into a triage bucket with a reason',
  input_schema: {
    type: 'object' as const,
    properties: {
      classifications: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            wo_number: { type: 'string', description: 'The work order number' },
            recommendation: {
              type: 'string',
              enum: ['close', 'finish', 'migrate'],
              description: 'The triage category',
            },
            reason: {
              type: 'string',
              description: 'One sentence explaining why this classification was chosen',
            },
          },
          required: ['wo_number', 'recommendation', 'reason'],
        },
      },
    },
    required: ['classifications'],
  },
};

// ────────────────────────────────────────────────
// Batch classification
// ────────────────────────────────────────────────

export async function triageWorkOrderBatch(
  workOrders: TriageInput[]
): Promise<TriageResult[]> {
  const now = new Date();

  // Build the user message with work order details
  const woList = workOrders
    .map((wo, i) => {
      const age = Math.floor(
        (now.getTime() - new Date(wo.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      const lastUpdated = Math.floor(
        (now.getTime() - new Date(wo.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      return `${i + 1}. WO #${wo.wo_number || 'N/A'}
   Property: ${wo.property_name}${wo.unit_name ? ` — ${wo.unit_name}` : ''}
   Description: ${wo.description}
   Category: ${wo.category || 'N/A'} | Priority: ${wo.priority || 'N/A'}
   AppFolio Status: ${wo.appfolio_status || 'N/A'}
   Vendor: ${wo.vendor_name || 'None'} | Assigned To: ${wo.assigned_to || 'None'}
   Scheduled: ${wo.scheduled_start || 'Not scheduled'}
   Age: ${age} days | Last Updated: ${lastUpdated} days ago`;
    })
    .join('\n\n');

  const userMessage = `Classify the following ${workOrders.length} work orders:\n\n${woList}`;

  const message = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [CLASSIFY_TOOL],
    tool_choice: { type: 'tool', name: 'classify_work_orders' },
    messages: [{ role: 'user', content: userMessage }],
  });

  // Extract tool use result
  const toolBlock = message.content.find((block) => block.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('No tool_use block in AI response');
  }

  const input = toolBlock.input as { classifications: Array<{ wo_number: string; recommendation: string; reason: string }> };

  // Map results back to work order IDs
  return input.classifications.map((c) => {
    // Find the matching work order by wo_number
    const wo = workOrders.find(
      (w) => (w.wo_number || 'N/A') === c.wo_number
    );
    return {
      id: wo?.id || '',
      wo_number: c.wo_number,
      recommendation: c.recommendation as 'close' | 'finish' | 'migrate',
      reason: c.reason,
    };
  });
}

// ────────────────────────────────────────────────
// Chunk helper
// ────────────────────────────────────────────────

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
