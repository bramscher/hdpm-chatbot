# HDPM Operations Dashboard

Internal operations platform for **High Desert Property Management** (~850 doors, Central Oregon). Automates inspections, work order triage, invoice generation, rent comp analysis, and Craigslist ad creation.

**Stack:** Next.js 16 / TypeScript / Supabase / Tailwind CSS / Vercel
**Auth:** Microsoft Azure AD (@highdesertpm.com only)
**Domain:** hdpmchat.highdesertpm.com

---

## Table of Contents

- [Getting Started](#getting-started)
- [Inspections](#inspections)
  - [Inspection Queue](#inspection-queue)
  - [Property Meld Sync](#property-meld-sync)
  - [Geocoding](#geocoding)
  - [Route Builder](#route-builder)
  - [Automated Tenant Notices](#automated-tenant-notices)
- [Craigslist Ad Creator](#craigslist-ad-creator)
- [Invoice Generator](#invoice-generator)
- [Work Order Triage](#work-order-triage)
- [Rent Comps](#rent-comps)
- [AI Chat (ORS 90)](#ai-chat-ors-90)
- [Scheduled Jobs (Crons)](#scheduled-jobs-crons)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Deployment](#deployment)

---

## Getting Started

```bash
npm install
cp .env.example .env.local   # Fill in all required env vars
npm run dev                   # http://localhost:3000
```

Login requires a `@highdesertpm.com` Microsoft account. All pages and API endpoints are protected behind Azure AD authentication.

---

## Inspections

**Path:** `/maintenance/inspections`

Manages biannual property inspections across ~850 doors. The system tracks every property, schedules inspections on 6-month cycles, builds optimized driving routes, and sends legally-required tenant notices via Property Meld.

### Inspection Queue

The main inspections page shows all properties with their inspection status, due date, assigned inspector, and notification status.

**Statuses:** Imported > Validated > Queued > Scheduled > In Progress > Completed

**How to use:**
1. Properties are synced from Property Meld (see below)
2. Each property gets one inspection. When completed, the next one is auto-created 6 months out
3. Filter by status, city, assignee, or search by address
4. Bulk update: select multiple inspections to change status, assignee, or priority at once
5. 12-Month Summary tab shows a calendar view of inspection volume

**Key rules:**
- Inspections require **7 days minimum lead time** before the scheduled date (Oregon tenant notice law)
- When an inspection is completed, the system automatically creates the next biannual inspection due 6 months later
- Unit numbers are tracked and displayed for multi-unit properties

### Property Meld Sync

**How to sync:**
1. Go to Inspections page
2. Click **Sync from Property Meld** button
3. The system pulls all properties and units from Property Meld, matches them against AppFolio for last-inspection dates, and creates inspection records

**What the sync does:**
- Fetches all properties and units from Property Meld API
- Matches addresses to AppFolio units to find `lastInspectedDate` and `moveInDate`
- Creates `inspection_properties` records (address, coordinates, PM IDs)
- Creates one inspection per property/unit with calculated due dates
- Sets `unit_name` on each inspection from the PM unit data
- Backfills unit names on any existing inspections missing them
- Skips excluded properties (HOAs, commercial)

**Due date calculation:** `last_inspection_date + 6 months`, clamped to today if overdue. Falls back to `move_in_date + 6 months` if no inspection history exists.

### Geocoding

Properties must be geocoded before they can be added to routes (the route optimizer needs lat/lng coordinates).

**How to geocode:**
1. Click **Geocode** button on the inspections page
2. Only processes properties with status `pending` or `failed` — already-geocoded properties are skipped
3. Uses Google Maps Geocoding API in batches of 10 with rate limiting
4. After a sync, just run geocode to process the new ones

### Route Builder

**Path:** `/maintenance/inspections/routes`

Creates optimized driving routes for inspectors. Groups properties geographically and uses nearest-neighbor routing to minimize drive time.

**How to create a route:**
1. Go to Route Builder
2. Set the date range (must be 7+ days out for tenant notice compliance)
3. Assign an inspector
4. Click **Generate** — the system auto-selects the most urgent inspections and builds an optimized route

**Routing algorithm:**
- **Address clustering:** All units at the same physical address are always grouped on the same route day. A 16-unit apartment complex at 2796 SW 23rd becomes one day's work, not spread across weeks.
- **Dedicated days:** If a single address has enough units to fill a route (>= max stops), it gets its own dedicated route day automatically.
- **City clustering:** Properties are grouped by city (Bend, Redmond, Sisters, Prineville, La Pine, Madras) since Central Oregon cities are 20-40 min apart.
- **Priority sorting:** Overdue inspections first, then by due date, then by priority level.
- **Route optimization:** Nearest-neighbor TSP starting from HDPM office (1515 SW Reindeer Ave, Redmond). Can be further optimized with Google Directions API.

**Unit numbers in routes:**
- Each stop displays the address with a prominent unit number badge (e.g. **#101**, **#A**)
- Multi-unit buildings show all their units in sequence with 0 min drive time between them
- Unit numbers come from Property Meld sync data

**Using a route on inspection day:**
1. Open the route from Route Builder
2. Each stop shows address, unit number badge, drive time, due date, and service time
3. Click **Start Inspection** — creates a Property Meld work order and begins the inspection
4. Click **Complete** when done, or **Skip** to return it to the queue
5. Use **Flag Issue** to mark problems found during inspection
6. When all stops are done, the route auto-completes

### Automated Tenant Notices

**Legal requirement:** Oregon law requires advance notice before property inspections. The system automates this entirely through Property Meld.

**Notice schedule:**

| Timing | Action | What tenant receives |
|--------|--------|---------------------|
| **7 days before** | Creates a Property Meld meld with tenant(s) attached | Formal inspection notice with date, address, and contact info |
| **24 hours before** | Adds a reminder message to the meld | "Your inspection is tomorrow" reminder |
| **2 hours before** | Adds a final message to the meld | "Inspector arriving shortly" notification |

**How it works:**
- A Vercel cron job runs **every hour** checking for scheduled inspections within the next 8 days
- For the 7-day notice: looks up the tenant(s) on the unit via Property Meld and creates a meld with them attached (triggers PM's built-in email/text notification)
- For 24h and 2h reminders: adds a chat message to the existing meld (triggers another PM notification)
- Tracks which notices have been sent (`notice_7d_sent_at`, `notice_24h_sent_at`, `notice_2h_sent_at`) to prevent duplicates
- Each notice includes the Property Meld meld ID for audit trail

**Monitoring notice status:**
- The inspections table shows a **Notices** column with a clickable status badge
- **Gray "Pending"** — no notices sent yet
- **Amber "1/3 Sent"** or **"2/3 Sent"** — some notices delivered
- **Green "All Sent"** with shield icon — all 3 notices confirmed
- Click any badge to open a detail modal showing:
  - Exact timestamp of each sent notice (e.g. "Sent via Property Meld on Apr 2, 2026, 9:00 AM")
  - Property Meld meld ID for audit/legal reference
  - Legal compliance confirmation banner

**Testing without notifying tenants:**

| Mode | How to trigger | What happens |
|------|---------------|-------------|
| **Dry run** | `POST /api/inspections/notify?mode=dry_run` | Logs what would happen — no PM API calls, no DB writes |
| **Silent** | `POST /api/inspections/notify?mode=silent` | Creates real melds in PM but `hidden_from_tenant=true` — visible in PM dashboard, tenants never see it |
| **Live** | `POST /api/inspections/notify` (default) | Production mode — tenants are notified |

The response includes an `actions` array showing exactly what was sent or would be sent.

---

## Craigslist Ad Creator

**Path:** `/craigslist`

Generates professional, HTML-formatted Craigslist rental listings from AppFolio vacancy data.

**Workflow:**
1. Open the Craigslist tool — cached vacancies load instantly from Supabase
2. Click **Sync Vacancies** to pull fresh data from AppFolio (upserts new units, removes ones no longer vacant)
3. Optionally toggle **Rently** on for units with self-guided tour access and enter the Rently URL
4. Click **Generate Listing** — Claude AI creates HTML-formatted copy
5. Review the preview (shown first by default)
6. Click **Copy HTML to Clipboard** and paste directly into Craigslist's posting body
7. Use **Download All** or **Open All in Tabs** for photos, then drag into Craigslist's image uploader

**Listing format:**
- Quick-glance summary table (rent, beds, baths, sqft, availability)
- "About This Home" section with neighborhood context
- "Features & Amenities" bullet list with bold key selling points
- "Apply Now" link to rentzap.com
- "Questions? We're Available 24/7" contact block with phone and website
- Rently self-guided tour block (when enabled)
- Professional disclaimer footer with HDPM address
- All HTML uses Craigslist-compatible tags only (`h2`, `table`, `ul`, `b`, `hr`, `a`, `p`)
- Section headers in HDPM brand green (#2c4a29)

**Editing:**
- Preview is the default view for quick copy-paste workflow
- Expand **Edit HTML Source** to modify the title, Rently URL, or body HTML
- Changes reflect live in the preview above
- Click **Save** to store listings in Supabase for history/re-use

**Photos:**
- Automatically scraped from AppFolio's public listings page
- Craigslist strips `<img>` tags — photos must be uploaded through their image uploader
- **Download All** saves images as files you can drag into Craigslist
- **Open All in Tabs** opens each photo in a browser tab for drag-and-drop

**Vacancy caching:**
- Vacancies are cached in Supabase so the page loads instantly
- **Sync Vacancies** pulls fresh from AppFolio, upserts new/changed units, and removes stale ones
- Units that get rented disappear automatically on next sync

---

## Invoice Generator

**Path:** `/maintenance/invoices`

Creates maintenance invoices from three input sources:

1. **AppFolio Work Orders** — pull open work orders and generate invoices with auto-populated line items
2. **CSV Upload** — import invoice line items from spreadsheets
3. **PDF Scan** — extract invoice data from scanned/photographed PDFs using Claude AI

**Features:**
- Line items with Type (Labor/Materials/Other), Qty, Price, Extended (auto-calculated)
- Default labor rate $95/hr with after-hours/emergency toggle (1.5x = $142.50/hr)
- Claude AI rewrites work descriptions into professional invoice language
- Auto-extracts materials and line items from descriptions
- PDF export with HDMS branding (Qty/Price/Extended columns, subtotals, totals)
- Auto-save with 2-second debounce
- Internal notes pre-populated with full work order reference data
- Status tracking: Draft > Submitted > Paid

---

## Work Order Triage

**Path:** `/maintenance/triage`

AI-powered prioritization of open AppFolio work orders.

**How it works:**
1. Syncs open work orders from AppFolio (runs daily at 8 AM PT or manually via **Sync Now**)
2. AI scores each work order by urgency and priority
3. Detects recurring maintenance issues across properties
4. Provides recommended actions and priority rankings
5. Filter by status, priority, vendor, or search across properties

**Status badges:** New, Assigned, Scheduled, Estimated, Waiting, Work Completed, Completed, Canceled

---

## Rent Comps

**Path:** `/comps`

Rental market analysis combining three data sources:

- **AppFolio** — current portfolio rental rates and vacancy data
- **Rentometer** — market comparison data by address
- **HUD Fair Market Rent** — government baseline rates by area (synced annually)

**Features:**
- Search and compare rental rates by address, city, or property type
- Weighted similarity scoring (bedrooms, bathrooms, sqft, distance)
- PDF comp analysis reports for owner presentations
- Market trend tracking
- Automatic baseline seeding from HUD data

---

## AI Chat (ORS 90)

**Sidebar:** Click **ORS 90 Chat** in the left navigation

An AI assistant trained on Oregon Revised Statutes Chapter 90 (landlord-tenant law), HDPM policy documents, and Loom training videos.

**Capabilities:**
- Answer questions about Oregon landlord-tenant law with specific ORS section references
- Hybrid search: vector similarity (pgvector) + full-text search for optimal retrieval
- Upload PDFs/emails for legal analysis against ORS 90
- Inline [1][2][3] citations with clickable source sidebar
- Streaming responses via Server-Sent Events
- Team conversation history shared across all @highdesertpm.com users

**Search strategies (auto-selected by query intent):**

| Intent | Example | Strategy |
|--------|---------|----------|
| Phrase lookup | "where does it say 'reasonable wear and tear'" | Phrase search + vector fallback |
| Section lookup | "what does 90.300 say" | Substring (ILIKE) + vector |
| Keyword | "which section mentions late fees" | Full-text + vector (merged) |
| Semantic | "can I charge for carpet cleaning" | Vector primary + full-text supplement |

---

## Scheduled Jobs (Crons)

Configured in `vercel.json`. All times are UTC.

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| **Every hour** | `/api/inspections/notify` | Send tenant inspection notices (7d, 24h, 2h) via Property Meld |
| **8 AM daily** | `/api/sync/work-orders` | Sync AppFolio work orders for triage |
| **9 AM daily** | `/api/sync/appfolio` | Full AppFolio sync: properties, vacancies, comps |
| **10 AM, Jan 1** | `/api/sync/hud` | Annual HUD Fair Market Rent data refresh |

Cron endpoints are authenticated via `CRON_SECRET` bearer token and exempted from Azure AD middleware.

---

## Environment Variables

### Required

| Variable | Service | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Database URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase | Client-side anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Server-side admin key |
| `AZURE_AD_CLIENT_ID` | Microsoft | Azure AD app client ID |
| `AZURE_AD_CLIENT_SECRET` | Microsoft | Azure AD app secret |
| `AZURE_AD_TENANT_ID` | Microsoft | Azure AD tenant |
| `NEXTAUTH_SECRET` | NextAuth | Session encryption key |
| `NEXTAUTH_URL` | NextAuth | App base URL (e.g. `https://hdpmchat.highdesertpm.com`) |
| `APPFOLIO_CLIENT_ID` | AppFolio | v0 API client ID |
| `APPFOLIO_CLIENT_SECRET` | AppFolio | v0 API client secret |
| `APPFOLIO_DEVELOPER_ID` | AppFolio | Developer ID header value |
| `PROPERTY_MELD_CLIENT_ID` | Property Meld | OAuth 2.0 client ID |
| `PROPERTY_MELD_CLIENT_SECRET` | Property Meld | OAuth 2.0 client secret |
| `CLAUDE_API_KEY` | Anthropic | Claude AI for listings, triage, invoice rewrites, chat |
| `GOOGLE_PLACES_API_KEY` | Google | Server-side geocoding API key |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Google | Client-side Maps JavaScript API key |

### Optional

| Variable | Service | Purpose |
|----------|---------|---------|
| `CRON_SECRET` | Vercel | Authenticates hourly cron job requests |
| `PROPERTY_MELD_API_URL` | Property Meld | API base URL (default: `https://api.propertymeld.com`) |
| `RENTOMETER_API_KEY` | Rentometer | Rental comp market data |
| `RENTCAST_API_KEY` | RentCast | Alternative rental data source |
| `HUD_API_TOKEN` | HUD.gov | Fair Market Rent annual data |
| `OPENAI_API_KEY` | OpenAI | Embeddings for knowledge base + fallback AI |

---

## Database

**Platform:** Supabase (PostgreSQL with pgvector extension)

**Key tables:**

| Table | Purpose |
|-------|---------|
| `inspection_properties` | Physical property records with PM/AppFolio IDs, coordinates, and unit counts |
| `inspections` | Inspection tasks with due dates, status, unit names, notice tracking, and meld IDs |
| `route_plans` | Inspection routes with dates, assignees, stop counts, and time estimates |
| `route_stops` | Individual stops within routes with ordering, status, and arrival times |
| `saved_listings` | Saved Craigslist listing drafts with generated HTML |
| `cached_vacancies` | Cached AppFolio vacancy data for instant page load |
| `conversations` | AI chat conversation metadata |
| `conversation_messages` | Individual chat messages with sources and attachments |
| `knowledge_chunks` | pgvector knowledge base chunks for ORS 90 semantic search |
| `import_batches` | CSV/XLSX upload audit trail for inspection imports |
| `inspection_audit_log` | Immutable change tracking for inspection operations |

**Migrations:** Located in `supabase/migrations/`. Run new migrations via the [Supabase SQL Editor](https://supabase.com/dashboard).

---

## Deployment

Deployed on **Vercel** with automatic deploys from the `main` branch.

```bash
npm run build    # Verify build passes locally
git push         # Triggers Vercel deploy
```

**Production URL:** `hdpmchat.highdesertpm.com`

**Branch strategy:**
- `main` — production, auto-deploys to Vercel
- `feat/*` — feature branches, merged via PR
