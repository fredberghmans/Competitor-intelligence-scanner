# Competitor Intelligence Scanner

An AI-powered system that monitors competitor websites, detects changes, and generates structured strategic insights — automatically.

---

## What it does

1. **Crawls** competitor websites on demand or via CLI, following a curated list of relevant URL patterns (pricing, features, custody, etc.)
2. **Diffs** page content using SHA-256 hashing + Myers algorithm to detect only meaningful changes, ignoring noise like analytics scripts
3. **Analyses** changed content through a three-stage Claude AI pipeline: classification → data extraction → strategic insights
4. **Stores** structured data points per competitor × criterion, with full scan history preserved
5. **Displays** insights, benchmarks, recommendations, and a side-by-side comparison table across all tracked competitors

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Database | Supabase (Postgres + Row Level Security) |
| AI | Anthropic Claude — Haiku for extraction, Sonnet for insights |
| Styling | Tailwind CSS v4 |
| Testing | Vitest + Husky pre-commit hooks |
| Hosting | Vercel |
| Scraping | Cheerio (HTML parsing + cleaning) |

---

## Project structure

```
app/
  (dashboard)/
    competitors/          # Competitor list + CRUD
      [id]/
        edit/             # Edit competitor
        insights/         # AI insights page (summary, benchmarks, recommendations)
        data/             # Data points drill-down (per-competitor × criteria table)
    compare/              # Side-by-side comparison table across all competitors
    criteria/             # Criteria tree management

lib/
  crawler/                # Modular web crawler (fetch, clean, hash, deduplicate)
  diff/                   # Change detection engine (chunker, Myers diff, store)
  ai/                     # Three-stage AI pipeline (classify, extract, insights)
  scan/                   # Scan orchestrator (per-competitor + all-competitors)
  supabase/               # Typed Supabase client (browser + server + service role)
  competitors.ts          # Competitor CRUD + latest scan queries
  criteria.ts             # Criteria tree CRUD
  insights.ts             # Insights fetching + parsing
  data-points.ts          # Data points fetching + category grouping
  compare.ts              # Cross-competitor comparison pivot

scripts/
  runScan.ts              # CLI scan runner (supports --dry-run, --force, competitor ID)

supabase/
  migrations/
    0001_initial_schema.sql   # 7 tables: competitors, criteria, scans, pages, change_events, data_points, insights
    0002_rls_policies.sql     # RLS: anon read-only, service_role writes

tests/
  crawler/                # hash, urls, clean
  diff/                   # chunker, engine
  ai/                     # parseJSON
```

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/fredberghmans/Competitor-intelligence-scanner.git
cd Competitor-intelligence-scanner
npm install
```

### 2. Environment variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-key
```

- **Supabase URL + anon key** — Project Settings → API in the Supabase dashboard
- **Service role key** — same page, under "Service role" (keep this secret — server-side only)
- **Anthropic API key** — console.anthropic.com

### 3. Run database migrations

In the Supabase dashboard → SQL Editor, run the two migration files in order:

```
supabase/migrations/0001_initial_schema.sql
supabase/migrations/0002_rls_policies.sql
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/competitors`.

---

## Running a scan

### From the UI

Click **Run Scan** on any competitor card. The button shows a live progress state and displays pages crawled / changes detected when complete.

### From the CLI

```bash
# Scan one competitor by ID
npm run scan -- <competitor-id>

# Scan all competitors
npm run scan

# Dry run (no DB writes)
npm run scan -- --dry-run

# Force re-process even if no changes detected
npm run scan -- --force
```

### Via API

```bash
# Scan one competitor
curl -X POST /api/scans \
  -H "Content-Type: application/json" \
  -d '{"competitorId": "<id>"}'

# Scan all competitors
curl -X POST /api/scans

# With options
curl -X POST "/api/scans?dryRun=true&force=true" ...
```

> **Note:** Vercel Hobby has a 10-second function timeout. For full scans use the CLI or upgrade to Vercel Pro.

---

## AI pipeline

The pipeline runs automatically after crawling whenever page changes are detected.

**Stage 1 — Classification (Haiku)**
Each changed text chunk is classified against your criteria tree. Chunks with low relevance are dropped.

**Stage 2 — Extraction (Haiku)**
Relevant chunks are passed for structured data extraction. Each extracted value is linked to a criterion, a source URL, and a confidence level.

**Stage 3 — Insights (Sonnet)**
All extracted data points are consolidated into:
- Executive summary (TL;DR, strengths, weaknesses, positioning)
- Changes summary (what changed since last scan)
- Benchmarks (competitor vs. our values, with directional gaps)
- Strategic recommendations (prioritised action items)

Unchanged pages skip the pipeline entirely (hash check). Typical cost per scan with 5 changed chunks: ~$0.007.

---

## UI pages

| Page | Route | Description |
|---|---|---|
| Competitors | `/competitors` | Grid of all tracked competitors with scan status badges and action buttons |
| Add / Edit competitor | `/competitors/new`, `/competitors/[id]/edit` | Form with dynamic domain list |
| Insights | `/competitors/[id]/insights` | Executive summary, changes, benchmarks, recommendations |
| Data points | `/competitors/[id]/data` | Per-criterion table with values, confidence, source links, and coverage ring |
| Compare | `/compare` | Side-by-side table of all competitors × criteria, with sticky labels and hover source links |
| Criteria | `/criteria` | Tree editor for categories and leaf criteria |

---

## Data model

Seven tables in Postgres:

| Table | Purpose |
|---|---|
| `competitors` | Name, type, region, domains (JSONB array) |
| `criteria` | Self-referential tree (parent_id). Categories at root, leaf criteria as children |
| `scans` | One row per scan run, tracks status + timing |
| `pages` | Crawled page snapshots with content hash and cleaned text |
| `change_events` | Diff records per page per scan |
| `data_points` | Upserted per (competitor, criterion) — one current value, updated each scan |
| `insights` | One row per insight type per scan. History preserved across scans |

RLS: browser clients (anon key) get read-only access. The AI pipeline uses the service role key for writes.

---

## Tests

```bash
npm test          # run once
npm run test:watch  # watch mode
```

Tests run automatically on every commit via Husky. Coverage includes the crawler (hash, URL normalisation, HTML cleaning), diff engine (chunk splitting, Myers diff, noise filtering), and AI utilities (JSON parsing from fenced/prose responses).

---

## Notes

- Only public web pages are crawled — no login, no scraping behind auth
- Source URLs are stored with every extracted data point for traceability
- The diff engine operates on cleaned text (scripts, ads, and nav elements are stripped) to avoid false positives
- `data_points` uses a unique constraint on `(competitor_id, criteria_id)` — each scan upserts the latest value, history is preserved in `change_events` and `insights`
- The codebase is intentionally modular — each layer (`crawler`, `diff`, `ai`, `scan`) can be replaced or extended independently
