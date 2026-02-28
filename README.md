# HDPM Chatbot & Automation Dashboard

An internal automation platform for High Desert Property Management built with Next.js 16. Combines a RAG-powered knowledge assistant for Oregon landlord-tenant law (ORS Chapter 90), a rent comparison toolkit, and a full maintenance work order + invoicing system integrated with AppFolio.

## Modules

### 1. Knowledge Assistant (Chat)

RAG-powered chatbot that helps property managers find accurate information about ORS Chapter 90 and company policies.

- **Hybrid Search**: Combines vector similarity (pgvector) with PostgreSQL full-text search
- **Intent Detection**: Automatically chooses optimal search strategy based on query type
- **Streaming Responses**: Real-time Claude responses via Server-Sent Events
- **Document Analysis**: Upload PDFs/emails for legal analysis against ORS 90
- **Inline Citations**: [1][2][3] style citations with clickable source sidebar
- **Team Conversation History**: Shared conversation history across all team members

### 2. Rent Comparison Toolkit (Comps)

Market analysis tool for Central Oregon rental properties.

- **Multi-Source Data**: AppFolio properties, Zillow, Rentometer, HUD FMR baselines
- **Similarity Scoring**: Weighted matching on bedrooms, bathrooms, sqft, distance
- **Address Lookup**: Google geocoding + RentCast property data
- **Branded PDF Reports**: Generate rent analysis reports with HDPM branding
- **Comp Filters**: Date range, data source, property type filtering

### 3. Maintenance & Invoicing (High Desert Maintenance Services)

Full work order management and invoice generation system for HDMS.

- **AppFolio Sync**: Pulls work orders, vendors (513+), and properties via v0 Database API
- **Vendor Filter**: Default filter to HDMS vendor with toggle for all vendors
- **Tabbed Dashboard**: Work Orders and Invoices tabs with stats cards (Open/Done/Closed)
- **Status Filters**: Granular AppFolio status pills (New, Assigned, Scheduled, Estimated, Waiting, Work Completed, Completed, Canceled)
- **Priority Sorting**: Emergency, Urgent, High, Normal, Low with color-coded badges
- **Pagination**: 20 work orders per page with sort by property, status, priority, date
- **Search**: Full-text search across property name, address, WO number
- **CSV Export**: Download filtered work orders as CSV

#### Invoice Creator

- **Line Items**: Type (Labor/Materials/Other) with Qty, Price, and Extended (auto-calculated) columns
- **Labor Rates**: Default $95/hr with after-hours/emergency toggle (1.5x = $142.50/hr)
- **Flat Fee Lookup**: Dropdown for standard repeat jobs (structure ready for user-provided list)
- **Auto-Calculate**: Extended amount = Qty x Price, auto-computed on input
- **AI Rewrite**: One-click professional rewrite of line item descriptions via Claude
- **Auto-Save**: 2-second debounced auto-save with unsaved changes indicator
- **PDF Generation**: Branded HDMS invoice PDFs with Qty/Price/Extended columns, subtotals, and total
- **Work Order Reference**: Internal notes pre-populated with comprehensive WO data (property, status, dates, vendor instructions, technician notes, description, tasks)
- **PDF/CSV Upload**: Scan work order PDFs or upload CSV batch files

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript, Turbopack)
- **Authentication**: NextAuth.js 4 with Azure AD provider
- **Database**: Supabase (PostgreSQL + pgvector extension)
- **Embeddings**: OpenAI text-embedding-3-small (1536 dimensions)
- **Chat AI**: Claude Sonnet 4 via Anthropic API
- **PDF Generation**: jsPDF for invoice and rent report PDFs
- **External APIs**: AppFolio v0 Database API, Google Geocoding, Zillow, Rentometer, HUD FMR
- **Styling**: Tailwind CSS + shadcn/ui + custom glass morphism utilities

## Search Architecture (Chat)

| Query Intent | Example | Search Strategy |
|-------------|---------|-----------------|
| `phrase_lookup` | "where does it say 'reasonable wear and tear'" | Phrase search + vector fallback |
| `section_lookup` | "what does 90.300 say" | Substring (ILIKE) + vector |
| `keyword` | "which section mentions late fees" | Full-text + vector (merged) |
| `semantic` | "can I charge for carpet cleaning" | Vector primary + full-text supplement |

## Prerequisites

1. Supabase project with pgvector extension enabled
2. Azure AD app registration (for SSO)
3. OpenAI API key
4. Anthropic API key
5. AppFolio API credentials (for maintenance module)

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

# AppFolio (for work orders / maintenance)
APPFOLIO_CLIENT_ID=your-client-id
APPFOLIO_CLIENT_SECRET=your-client-secret
APPFOLIO_DATABASE_ID=your-database-id
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
│   │   ├── auth/[...nextauth]/     # NextAuth Azure AD config
│   │   ├── chat/stream/            # Streaming chat endpoint
│   │   ├── comps/                  # Rent comp CRUD, analysis, reports
│   │   ├── conversations/          # Conversation CRUD
│   │   ├── invoices/               # Invoice CRUD, PDF generation, download
│   │   ├── parse-pdf/              # PDF text extraction
│   │   ├── sync/                   # AppFolio sync (work orders, comps, HUD)
│   │   ├── webhooks/               # AppFolio webhooks
│   │   └── work-orders/            # Work order API endpoints
│   ├── comps/                      # Rent Comparison Toolkit
│   │   ├── analysis/               # Comp analysis view
│   │   └── comps-dashboard.tsx     # Main comps dashboard
│   ├── maintenance/
│   │   └── invoices/
│   │       ├── invoice-dashboard.tsx  # Tabbed WO + invoice dashboard
│   │       ├── invoice-form.tsx       # Invoice creator with qty/price/extended
│   │       ├── invoice-list.tsx       # Invoice history list
│   │       ├── csv-uploader.tsx       # CSV/PDF upload drop zone
│   │       └── work-order-table.tsx   # CSV work order table view
│   ├── login/                      # Login page
│   ├── globals.css                 # Glass morphism styles
│   ├── layout.tsx                  # Root layout with mesh gradient
│   └── page.tsx                    # HDPM Automation Dashboard landing
├── components/
│   ├── ui/                         # shadcn/ui components
│   ├── ChatWidget.tsx              # Floating chat FAB
│   ├── ChatWindow.tsx              # Main chat interface
│   ├── CitationsSidebar.tsx        # Legal sources panel
│   ├── ConversationHistory.tsx     # Team history sidebar
│   └── Message.tsx                 # Message with citations
├── lib/
│   ├── appfolio.ts                 # AppFolio v0 API client (WOs, vendors, properties)
│   ├── comps.ts                    # Rent comp database functions
│   ├── invoice-pdf-template.ts     # jsPDF invoice template (Qty/Price/Extended)
│   ├── invoices.ts                 # Invoice types + Supabase CRUD
│   ├── rag.ts                      # Hybrid search + Claude streaming
│   ├── rent-analysis.ts            # Rent analysis logic
│   ├── rent-report-pdf.ts          # Rent report PDF template
│   ├── supabase.ts                 # Supabase client + database functions
│   ├── work-orders.ts              # Work order types + Supabase CRUD
│   ├── address-lookup.ts           # Google geocoding + RentCast
│   ├── zillow.ts                   # Zillow data client
│   ├── rentometer.ts               # Rentometer API client
│   ├── hud.ts                      # HUD FMR data client
│   └── hdpm-logo.ts                # Base64 logo for PDFs
└── scripts/
    ├── add-fulltext-search.sql     # Full-text search migration
    └── create-conversations-table.sql
```

## Key Workflows

### Work Order to Invoice

1. Click **Sync Now** to pull latest work orders from AppFolio
2. Filter by status, priority, vendor, or search
3. Click **+** on a work order to create an invoice
4. Line items auto-populate from WO data; internal notes filled with full WO reference
5. Enter Qty and Price per line — Extended calculates automatically
6. Toggle **AH** for after-hours labor (1.5x rate)
7. Click **Generate Invoice PDF** — branded PDF with all line item detail
8. Invoice auto-saves every 2 seconds as you edit

### AppFolio Data Sync

- **Work Orders**: Syncs all WOs with status, priority, vendor name resolution
- **Vendors**: Fetches 500+ vendors, builds ID-to-name map for WO display
- **Properties**: Syncs property names and addresses for invoice pre-population
- **Webhooks**: Endpoint at `/api/webhooks/appfolio` for real-time updates

## Deployment

Deployed on Vercel with automatic deploys from the `main` branch. Environment variables are configured in Vercel project settings.
