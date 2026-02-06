import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { searchKnowledgeChunks, KnowledgeChunk } from './supabase';

// Lazy initialization to avoid build-time issues
let _openai: OpenAI | null = null;
let _anthropic: Anthropic | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    // Try ANTHROPIC_API_KEY first, then fall back to CLAUDE_API_KEY
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY or CLAUDE_API_KEY environment variable is not set');
    }
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

// Source type icons mapping
export const SOURCE_ICONS: Record<string, string> = {
  ors_90: '⚖️',
  loom_video: '🎬',
  policy_doc: '📄',
};

// Types for RAG response
export interface Source {
  id: string;
  title: string;
  url: string;
  type: string;
  icon: string;
  section: string | null;
}

export interface RAGResponse {
  answer: string;
  sources: Source[];
}

/**
 * Query expansion mappings for common terms
 * Maps colloquial/common terms to their legal equivalents in ORS 90
 */
const QUERY_EXPANSIONS: Record<string, string[]> = {
  // Animal-related terms
  'emotional support animal': ['assistance animal', 'service animal', 'pet', 'animal accommodation'],
  'esa': ['assistance animal', 'service animal', 'emotional support animal'],
  'support animal': ['assistance animal', 'service animal', 'pet'],
  'service dog': ['service animal', 'assistance animal'],
  'therapy animal': ['assistance animal', 'service animal'],

  // Deposit-related terms
  'deposit': ['security deposit', 'prepaid rent', 'last month rent'],
  'move out': ['termination', 'vacate', 'security deposit', 'accounting'],
  'move-out': ['termination', 'vacate', 'security deposit', 'accounting'],

  // Eviction-related terms
  'eviction': ['termination', 'for cause', 'notice', 'unlawful detainer'],
  'evict': ['terminate', 'termination notice', 'for cause'],
  'kick out': ['terminate', 'termination', 'eviction'],

  // Rent-related terms
  'late fee': ['late charge', 'late rent', 'rent payment'],
  'rent increase': ['rent raise', 'increased rent'],
  'raise rent': ['rent increase', 'increased rent'],

  // Repair-related terms
  'repair': ['maintenance', 'habitability', 'essential services'],
  'fix': ['repair', 'maintenance', 'habitability'],
  'broken': ['repair', 'maintenance', 'defective'],

  // Lease-related terms
  'lease': ['rental agreement', 'tenancy'],
  'month to month': ['periodic tenancy', 'month-to-month'],
  'break lease': ['early termination', 'terminate tenancy'],
};

/**
 * Expand a query with related legal terms
 */
function expandQuery(query: string): string {
  const lowerQuery = query.toLowerCase();
  const expansions: string[] = [];

  for (const [term, relatedTerms] of Object.entries(QUERY_EXPANSIONS)) {
    if (lowerQuery.includes(term)) {
      expansions.push(...relatedTerms);
    }
  }

  if (expansions.length === 0) {
    return query;
  }

  // Deduplicate and append expansions
  const uniqueExpansions = [...new Set(expansions)];
  return `${query} ${uniqueExpansions.join(' ')}`;
}

/**
 * Generate embedding for a query using OpenAI's text-embedding-3-small model
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Search the knowledge base for relevant chunks
 */
export async function searchKnowledge(
  query: string,
  threshold: number = 0.7,
  count: number = 5
): Promise<KnowledgeChunk[]> {
  // Expand the query with related legal terms
  const expandedQuery = expandQuery(query);
  const wasExpanded = expandedQuery !== query;
  
  // Log query expansion for debugging
  if (wasExpanded) {
    console.log(`[RAG] Query expanded: "${query}" -> "${expandedQuery}"`);
  }
  
  const embedding = await generateEmbedding(expandedQuery);
  const chunks = await searchKnowledgeChunks(embedding, threshold, count);
  
  // Log retrieval results for debugging
  if (chunks.length > 0) {
    const avgSimilarity = chunks.reduce((sum, c) => sum + (c.similarity || 0), 0) / chunks.length;
    const minSimilarity = Math.min(...chunks.map(c => c.similarity || 0));
    const maxSimilarity = Math.max(...chunks.map(c => c.similarity || 0));
    
    console.log(`[RAG] Retrieved ${chunks.length} chunks (threshold: ${threshold})`);
    console.log(`[RAG] Similarity scores: min=${(minSimilarity * 100).toFixed(2)}%, avg=${(avgSimilarity * 100).toFixed(2)}%, max=${(maxSimilarity * 100).toFixed(2)}%`);
    console.log(`[RAG] Sections: ${chunks.map(c => c.source_section || 'none').join(', ')}`);
  } else {
    console.log(`[RAG] No chunks found with threshold ${threshold}`);
  }
  
  return chunks;
}

/**
 * Build context from knowledge chunks with source references
 */
function buildContext(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) {
    return 'No relevant information found in the knowledge base.';
  }

  return chunks
    .map((chunk, index) => {
      const sourceNum = index + 1;
      return `[Source ${sourceNum}] ${chunk.source_title}${chunk.source_section ? ` - ${chunk.source_section}` : ''}:\n${chunk.content}`;
    })
    .join('\n\n');
}

/**
 * Extract sources from chunks for the response
 */
function extractSources(chunks: KnowledgeChunk[]): Source[] {
  return chunks.map((chunk) => ({
    id: chunk.id,
    title: chunk.source_title,
    url: chunk.source_url,
    type: chunk.source_type,
    icon: SOURCE_ICONS[chunk.source_type] || '📄',
    section: chunk.source_section,
  }));
}

/**
 * Main RAG function: search knowledge base and generate response with Claude
 */
export async function askRAG(question: string): Promise<RAGResponse> {
  // Step 1: Search the knowledge base (threshold lowered to 0.30 for better recall)
  const chunks = await searchKnowledge(question, 0.30, 5);

  // Step 2: Build context from retrieved chunks
  const context = buildContext(chunks);
  const sources = extractSources(chunks);

  // Step 3: Build the system prompt
  const systemPrompt = `You are the internal knowledge assistant for High Desert Property Management. Your role is to help property managers, leasing agents, and staff quickly find accurate information about landlord-tenant law, company policies, and procedures.

CONTEXT:
- This is an INTERNAL tool for High Desert Property Management staff only
- Users are professionals who need practical, actionable guidance
- Focus on Oregon landlord-tenant law (ORS Chapter 90) and company policies
- Always consider the landlord/property manager perspective when answering
- The knowledge base contains the COMPLETE Oregon ORS Chapter 90 (163 sections covering residential landlord-tenant law, manufactured dwelling parks, and marinas)

RESPONSE FORMAT:
1. Start with a brief, direct answer to the question
2. Use clear headers (## Header) to organize longer responses
3. Use bullet points for lists and requirements
4. Include specific ORS section numbers, timeframes, and limits when available
5. Add practical tips or warnings where relevant (e.g., "Important:", "Note:")

CITATIONS:
- Use inline citations [1], [2], etc. for ALL factual claims from the knowledge base
- Place citations immediately after the relevant statement
- Multiple citations can be grouped: [1][2]
- Always cite the specific ORS section number when referencing the law

TONE:
- Professional but approachable
- Confident when information is clear
- Honest about limitations or ambiguities in the law
- Suggest consulting legal counsel for complex situations

If the knowledge base doesn't contain relevant information, say so clearly and suggest appropriate next steps (e.g., consult the company handbook, speak with a supervisor, or seek legal advice).

The sources are numbered [1] through [${sources.length}] in the context below.`;

  // Step 4: Call Claude API
  const message = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Context from knowledge base:\n\n${context}\n\nQuestion: ${question}`,
      },
    ],
  });

  // Extract the text response
  const answer = message.content[0].type === 'text'
    ? message.content[0].text
    : 'Unable to generate response.';

  return {
    answer,
    sources,
  };
}

/**
 * Build system prompt for RAG
 */
function buildSystemPrompt(sourcesCount: number): string {
  return `You are the internal knowledge assistant for High Desert Property Management. Your role is to help property managers, leasing agents, and staff quickly find accurate information about landlord-tenant law, company policies, and procedures.

CONTEXT:
- This is an INTERNAL tool for High Desert Property Management staff only
- Users are professionals who need practical, actionable guidance
- Focus on Oregon landlord-tenant law (ORS Chapter 90) and company policies
- Always consider the landlord/property manager perspective when answering
- The knowledge base contains the COMPLETE Oregon ORS Chapter 90 (163 sections covering residential landlord-tenant law, manufactured dwelling parks, and marinas)

RESPONSE FORMAT:
1. Start with a brief, direct answer to the question
2. Use clear headers (## Header) to organize longer responses
3. Use bullet points for lists and requirements
4. Include specific ORS section numbers, timeframes, and limits when available
5. Add practical tips or warnings where relevant (e.g., "Important:", "Note:")

CITATIONS:
- Use inline citations [1], [2], etc. for ALL factual claims from the knowledge base
- Place citations immediately after the relevant statement
- Multiple citations can be grouped: [1][2]
- Always cite the specific ORS section number when referencing the law

TONE:
- Professional but approachable
- Confident when information is clear
- Honest about limitations or ambiguities in the law
- Suggest consulting legal counsel for complex situations

If the knowledge base doesn't contain relevant information, say so clearly and suggest appropriate next steps (e.g., consult the company handbook, speak with a supervisor, or seek legal advice).

The sources are numbered [1] through [${sourcesCount}] in the context below.`;
}

/**
 * Build system prompt for document analysis
 */
function buildDocumentAnalysisPrompt(sourcesCount: number, documentName?: string): string {
  return `You are the internal knowledge assistant for High Desert Property Management analyzing a document provided by staff.

CRITICAL INSTRUCTION:
The user has uploaded ${documentName ? `a document called "${documentName}"` : 'a document/email'} for you to analyze. You MUST read and analyze the ACTUAL CONTENT of their document (provided below) and explain how Oregon landlord-tenant law applies to their specific situation. Do NOT just describe what sources are available - actually analyze their document.

CONTEXT:
- This is an INTERNAL tool for High Desert Property Management staff only
- Users are professionals who need practical, actionable guidance
- Focus on Oregon landlord-tenant law (ORS Chapter 90) and company policies
- Always consider the landlord/property manager perspective when answering

YOUR TASK:
1. Read the user's document/correspondence carefully
2. Identify what the document is about (tenant complaint, notice, lease issue, etc.)
3. Quote or reference specific parts of their document when relevant
4. Explain which ORS 90 sections apply to their specific situation
5. Provide a recommended response or action plan

RESPONSE FORMAT:
## Document Summary
- Briefly describe what this document is (email from tenant, notice, complaint, etc.)
- Note the key issues or requests in the document

## Legal Analysis
- Cite specific ORS sections that apply
- Explain what the law requires in this situation
- Note any deadlines or timeframes

## Recommended Response
- Draft suggested language or outline a response
- Specify any required notices or forms
- Note any deadlines for landlord action

## Warnings/Risks (if applicable)
- Flag any potential legal issues
- Note if legal counsel should be consulted

CITATIONS:
- Use inline citations [1], [2], etc. when referencing the legal sources
- Always cite specific ORS section numbers

The legal reference sources are numbered [1] through [${sourcesCount}] in the context below.`;
}

/**
 * Streaming RAG function: search knowledge base and stream response from Claude
 * Optionally accepts document content for correspondence analysis
 */
export async function askRAGStream(
  question: string,
  documentContent?: string,
  documentName?: string
): Promise<{
  stream: AsyncIterable<string>;
  sources: Source[];
}> {
  // Log document analysis mode
  if (documentContent) {
    console.log(`[RAG] Document analysis mode: "${documentName || 'unnamed'}" (${documentContent.length} chars)`);
  }

  // Step 1: Search the knowledge base using ONLY the question
  // Don't pollute the search with document content - we want relevant ORS sections for the question
  const chunks = await searchKnowledge(question, 0.30, 5);

  // Step 2: Build context from retrieved chunks
  const context = buildContext(chunks);
  const sources = extractSources(chunks);

  // Step 3: Build the appropriate system prompt
  const systemPrompt = documentContent
    ? buildDocumentAnalysisPrompt(sources.length, documentName)
    : buildSystemPrompt(sources.length);

  // Step 4: Build user message content
  // For document analysis: Document FIRST, then legal context, then question
  // This ensures the AI focuses on the document as the primary content
  let userContent = '';

  if (documentContent) {
    userContent += `=== USER'S DOCUMENT TO ANALYZE ===\n`;
    userContent += `Document: ${documentName || 'Uploaded Document'}\n\n`;
    userContent += `${documentContent}\n\n`;
    userContent += `=== END OF DOCUMENT ===\n\n`;
    userContent += `=== RELEVANT OREGON LAW (ORS 90) FOR REFERENCE ===\n\n${context}\n\n`;
    userContent += `=== USER'S QUESTION ===\n${question}`;
  } else {
    userContent += `Context from knowledge base:\n\n${context}\n\n`;
    userContent += `Question: ${question}`;
  }

  // Step 5: Create streaming response from Claude
  const streamResponse = await getAnthropic().messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048, // Increased for document analysis
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
  });

  // Create an async generator that yields text chunks
  async function* textStream(): AsyncIterable<string> {
    for await (const event of streamResponse) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }

  return {
    stream: textStream(),
    sources,
  };
}
