# Competitor Intelligence Scanner

An AI-powered system that continuously monitors competitors and transforms publicly available data into structured, actionable intelligence for product and strategy teams.

## What it does

Instead of manual research, this system:

- Crawls competitor websites and external sources on a schedule
- Detects what changed since the last scan (diff-based)
- Sends only changed content to AI for classification and insight generation
- Structures outputs into predefined evaluation criteria
- Surfaces executive summaries, benchmarks, and strategic recommendations

The goal is to act as a **decision engine** — not just a dashboard.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) |
| Database | Supabase (Postgres + RLS) |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Hosting | Vercel |
| AI pipeline | Anthropic / OpenAI (planned) |
| Crawling | Serverless functions (planned) |

---

## Features (v1 — foundation)

- **Competitor management** — Add, edit, delete competitors with type, region, and multiple domains
- **Criteria management** — Define evaluation dimensions as a category → subcriteria tree
- **Database layer** — Full Supabase schema with RLS, indexes, and change tracking tables
- **Modular architecture** — Clean separation between UI, lib functions, and server actions

### Planned (pipeline)
- Website crawling with page-level hashing
- Change detection between scans
- AI classification of content into criteria
- Executive summaries and strategic recommendations
- Comparison table across competitors
- Change log / timeline view
- PDF export

---

## Project structure

```
app/
├── (dashboard)/
│   ├── competitors/          # List, create, edit
│   ├── criteria/             # Criteria tree management
│   └── layout.tsx            # Sidebar shell
├── layout.tsx
└── globals.css

components/
├── layout/Sidebar.tsx
├── ui/badge.tsx
├── competitors/
│   ├── CompetitorCard.tsx
│   └── CompetitorForm.tsx
└── criteria/
    └── CriteriaManager.tsx

lib/
├── supabase/
│   ├── client.ts             # Browser client
│   ├── server.ts             # Server + service-role clients
│   └── types.ts              # TypeScript types
├── actions/
│   ├── competitors.ts        # Server actions
│   └── criteria.ts
├── competitors.ts            # CRUD functions
└── criteria.ts               # CRUD + tree builder

supabase/
└── migrations/
    ├── 0001_initial_schema.sql
    └── 0002_rls_policies.sql
```

---

## Data model

```
competitors ──< scans ──< pages ──< change_events
     │
     └──< data_points >── criteria (tree)
     └──< insights
```

| Table | Purpose |
|---|---|
| `competitors` | Companies being tracked |
| `criteria` | Self-referential tree: category → subcriteria |
| `scans` | One crawl run per competitor |
| `pages` | URL snapshots with content hash for diffing |
| `change_events` | Diffs between scans — triggers AI processing |
| `data_points` | Structured AI output: one value per competitor × criteria |
| `insights` | AI narratives: summaries, recommendations, benchmarks |

---

## Local setup

### 1. Clone and install

```bash
git clone <repo-url>
cd competitor-intelligence-scanner
npm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a project, then copy your credentials from **Settings → API**.

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Run database migrations

In Supabase → **SQL Editor**, run in order:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Architecture decisions

**Diff-based processing** — Only pages whose content hash changed since the last scan are sent to AI. This keeps API costs low as the competitor count grows.

**RLS split** — Authenticated users can read all tables. Only the service-role key (server-side only) can write to `pages`, `change_events`, `data_points`, and `insights`. Browser code never touches pipeline data directly.

**Server actions over API routes** — CRUD mutations use Next.js Server Actions, keeping the code co-located with the UI and eliminating boilerplate API endpoints for simple operations.

**Criteria as a tree** — A self-referential `criteria` table (parent_id) supports arbitrary category → subcriteria depth without a separate junction table. The `getCriteriaTree()` function assembles the flat rows in memory.

**Azure portability** — No Supabase-specific features beyond standard Postgres. The `createServiceClient()` helper is isolated in `lib/supabase/server.ts`, making it straightforward to swap the backend.

---

## Non-functional requirements

- Public data only — no paywalled or private sources
- All AI outputs include source URLs for traceability
- Confidence scoring on data points: `high` (explicit) · `medium` (inferred) · `low` (external)
- Modular design — each layer (crawling, diffing, AI, UI) is independently replaceable

---

## Deployment

Deploy to Vercel:

```bash
npm i -g vercel
vercel
```

Add the same environment variables from `.env.local` in the Vercel project settings.
