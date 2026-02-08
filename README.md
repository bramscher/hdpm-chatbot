# HDPM Chatbot

An internal knowledge assistant for High Desert Property Management built with Next.js 16. Uses RAG (Retrieval-Augmented Generation) with hybrid search to help property managers quickly find accurate information about Oregon landlord-tenant law (ORS Chapter 90) and company policies.

## Features

- **Azure AD Authentication**: Secure SSO login restricted to @highdesertpm.com domain
- **Hybrid Search**: Combines vector similarity (pgvector) with PostgreSQL full-text search
- **Intent Detection**: Automatically chooses optimal search strategy based on query type
- **Streaming Responses**: Real-time Claude responses via Server-Sent Events
- **Document Analysis**: Upload PDFs/emails for legal analysis against ORS 90
- **Team Conversation History**: Shared conversation history across all team members
- **Inline Citations**: [1][2][3] style citations with clickable source sidebar
- **Glass Morphism UI**: Apple-inspired frosted glass design with violet/purple theme

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript, Turbopack)
- **Authentication**: NextAuth.js 4 with Azure AD provider
- **Database**: Supabase (PostgreSQL + pgvector extension)
- **Embeddings**: OpenAI text-embedding-3-small (1536 dimensions)
- **Chat AI**: Claude Sonnet 4 via Anthropic API
- **Styling**: Tailwind CSS + shadcn/ui + custom glass morphism utilities

## Search Architecture

The app uses a hybrid search system with automatic intent detection:

| Query Intent | Example | Search Strategy |
|-------------|---------|-----------------|
| `phrase_lookup` | "where does it say 'reasonable wear and tear'" | Phrase search + vector fallback |
| `section_lookup` | "what does 90.300 say" | Substring (ILIKE) + vector |
| `keyword` | "which section mentions late fees" | Full-text + vector (merged) |
| `semantic` | "can I charge for carpet cleaning" | Vector primary + full-text supplement |

Results from both search methods are merged and deduplicated, with items appearing in both sets receiving a relevance boost.

## Prerequisites

1. Supabase project with pgvector extension enabled
2. Azure AD app registration (for SSO)
3. OpenAI API key
4. Anthropic API key

## Database Setup

### 1. Knowledge Chunks Table

```sql
CREATE TABLE knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  embedding vector(1536),
  source_type text NOT NULL,  -- 'ors_90', 'loom_video', 'policy_doc'
  source_title text NOT NULL,
  source_url text NOT NULL,
  source_section text,
  fts tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);

CREATE INDEX knowledge_chunks_embedding_idx ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX knowledge_chunks_fts_idx ON knowledge_chunks USING GIN (fts);
```

### 2. Vector Search Function

```sql
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  threshold float,
  count int
)
RETURNS TABLE (
  id uuid,
  content text,
  source_type text,
  source_title text,
  source_url text,
  source_section text,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id, kc.content, kc.source_type, kc.source_title,
    kc.source_url, kc.source_section,
    1 - (kc.embedding <=> query_embedding) as similarity
  FROM knowledge_chunks kc
  WHERE 1 - (kc.embedding <=> query_embedding) > threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT count;
END;
$$;
```

### 3. Full-Text Search Functions

Run the migration in `scripts/add-fulltext-search.sql` to add:
- `search_knowledge_fulltext(query, max_results)` - Keyword search
- `search_knowledge_phrase(phrase, max_results)` - Exact phrase matching
- `search_knowledge_substring(text, max_results)` - ILIKE search for section numbers

### 4. Conversations Tables

Run `scripts/create-conversations-table.sql` to create:
- `conversations` - Stores conversation metadata
- `conversation_messages` - Stores messages with sources/attachments

## Environment Variables

Create `.env.local` with:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI (for embeddings)
OPENAI_API_KEY=sk-...

# Anthropic (for Claude responses)
ANTHROPIC_API_KEY=sk-ant-...

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret

# Azure AD
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_TENANT_ID=your-tenant-id
```

## Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your @highdesertpm.com Microsoft account.

## Project Structure

```
hdpm-chatbot/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/  # NextAuth Azure AD config
│   │   ├── chat/stream/         # Streaming chat endpoint
│   │   ├── conversations/       # Conversation CRUD
│   │   └── parse-pdf/           # PDF text extraction
│   ├── login/                   # Login page
│   ├── globals.css              # Glass morphism styles
│   ├── layout.tsx               # Root layout with mesh gradient
│   └── page.tsx                 # Landing page
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── ChatWidget.tsx           # Floating chat FAB
│   ├── ChatWindow.tsx           # Main chat interface
│   ├── CitationsSidebar.tsx     # Legal sources panel
│   ├── ConversationHistory.tsx  # Team history sidebar
│   └── Message.tsx              # Message with citations
├── lib/
│   ├── rag.ts                   # Hybrid search + Claude streaming
│   ├── supabase.ts              # Database functions
│   └── utils.ts                 # Utilities
└── scripts/
    ├── add-fulltext-search.sql  # Full-text search migration
    └── create-conversations-table.sql
```

## RAG Flow

1. User submits question (optionally with PDF attachment)
2. **Intent Detection**: Classify query as phrase/section/keyword/semantic
3. **Hybrid Search**: Run vector + full-text search in parallel
4. **Merge & Boost**: Deduplicate results, boost items in both sets
5. **Context Building**: Format top 15 chunks with source references
6. **Claude Streaming**: Stream response with inline citations [1][2][3]
7. **Save to DB**: Persist conversation for team history

## Citation Format

- **Inline**: "Late fees are limited to 5% of monthly rent [1]"
- **Sidebar**: Clickable source cards with ORS section numbers
- **Icons**: ⚖️ ORS 90 | 🎬 Loom videos | 📄 Policy docs

## Deployment

Deployed on Vercel with automatic deploys from the `main` branch. Environment variables are configured in Vercel project settings.
