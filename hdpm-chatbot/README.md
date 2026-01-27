# HDPM Chatbot

A Next.js 14 RAG (Retrieval-Augmented Generation) chatbot that searches a knowledge base and returns AI-powered answers with inline citations.

## Features

- Floating chat widget (bottom right corner)
- RAG system that searches Supabase/pgvector knowledge base
- Inline citations [1][2][3] with clickable source links
- Source type icons (⚖️ laws, 🎬 videos, 📄 docs)
- Powered by Claude Sonnet 4 for responses
- OpenAI text-embedding-3-small for embeddings

## Tech Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Database**: Supabase with pgvector extension
- **Embeddings**: OpenAI text-embedding-3-small
- **Chat AI**: Claude Sonnet 4 via Anthropic API
- **Styling**: Tailwind CSS + Shadcn/ui components

## Prerequisites

1. A Supabase project with the pgvector extension enabled
2. OpenAI API key
3. Anthropic API key

## Database Setup

Your Supabase database should have:

1. **Table**: `knowledge_chunks`
   - `id` (uuid, primary key)
   - `content` (text)
   - `embedding` (vector(1536))
   - `source_type` (text) - values: 'ors_90', 'loom_video', 'policy_doc'
   - `source_title` (text)
   - `source_url` (text)
   - `source_section` (text, nullable)

2. **Function**: `match_knowledge_chunks(query_embedding, threshold, count)`

Example function:

```sql
create or replace function match_knowledge_chunks(
  query_embedding vector(1536),
  threshold float,
  count int
)
returns table (
  id uuid,
  content text,
  source_type text,
  source_title text,
  source_url text,
  source_section text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    kc.id,
    kc.content,
    kc.source_type,
    kc.source_title,
    kc.source_url,
    kc.source_section,
    1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  where 1 - (kc.embedding <=> query_embedding) > threshold
  order by kc.embedding <=> query_embedding
  limit count;
end;
$$;
```

## Installation

1. Clone the repository and install dependencies:

```bash
cd hdpm-chatbot
npm install
```

2. Copy the environment template and fill in your values:

```bash
cp .env.example .env.local
```

3. Edit `.env.local` with your credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) and click the chat button.

## Project Structure

```
hdpm-chatbot/
├── app/
│   ├── api/chat/route.ts    # Chat API endpoint
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Landing page
├── components/
│   ├── ui/                  # Shadcn/ui components
│   ├── ChatWidget.tsx       # Floating chat button
│   ├── ChatWindow.tsx       # Chat interface
│   └── Message.tsx          # Message bubble with citations
├── lib/
│   ├── rag.ts              # RAG functions
│   ├── supabase.ts         # Supabase client
│   └── utils.ts            # Utility functions
└── .env.local              # Environment variables
```

## RAG Flow

1. User asks a question
2. Generate embedding with OpenAI text-embedding-3-small
3. Query Supabase: `match_knowledge_chunks(embedding, 0.7, 5)`
4. Build context from top 5 results
5. Call Claude API with context + question
6. Return answer with inline citations and source bibliography

## Citation Format

Responses include:
- **Inline citations**: "Late fees are limited to $50 or 5%[1]"
- **Bibliography**: Clickable links at the end of each response
- **Source icons**: ⚖️ (ors_90), 🎬 (loom_video), 📄 (policy_doc)
