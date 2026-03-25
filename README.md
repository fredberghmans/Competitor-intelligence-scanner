# Competitor Intelligence Scanner

An AI-powered system that monitors competitors and transforms publicly available data into structured, actionable intelligence for product and strategy teams.

## What it does

Instead of manual research, this system:

- Scans competitor websites using static crawling with Jina Reader fallback (handles SPAs and PDFs)
- Runs an AI research agent that searches the web for competitor information
- Extracts structured data points against your custom evaluation criteria
- Generates executive summaries and strategic insights
- Surfaces benchmarks and recommendations across all tracked competitors

The goal is to act as a **decision engine** — not just a dashboard.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack) |
| Database | Supabase (Postgres + RLS) |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Hosting | Vercel |
| AI — Anthropic | Claude Haiku (extract) · Claude Sonnet (insights + research) |
| AI — Google | Gemini 2.0 Flash (extract + research) · Gemini 2.5 Pro (insights) |
| Crawling | Cheerio (static) + Jina Reader (SPA/PDF fallback) |
| Tests | Vitest |

---

## Features

### Competitor management
- Add, edit, delete competitors with type, region, and multiple domains
- Per-competitor scan history with timestamps

### Scan modes
| Mode | How it works | Cost |
|---|---|---|
| **Crawl** | Fetches pages directly; falls back to Jina Reader for JS-heavy sites and PDFs | ~$0.007 |
| **Research** | AI agent searches the web (Google) for competitor information | ~$0.10 |
| **Crawl + Research** | Both methods combined, most thorough | ~$0.15 |

- Real-time progress during scans (turn count, current query, elapsed time)
- Stop button to cancel any in-progress scan

### Criteria management
- Define evaluation dimensions as a category → subcriteria tree
- Data points are mapped to criteria automatically, with fuzzy name matching as fallback

### Data & insights
- Structured data point extraction with confidence scoring (`high` / `medium`)
- Source URL tracked for every data point
- AI-generated insights: summaries, recommendations, benchmarks
- Coverage indicator showing how many criteria have been filled per competitor

### AI provider settings
- Switch between Anthropic Claude and Google Gemini from the Settings page
- Provider preference stored in the database; API keys set via environment variables only

---

## Project structure

```
app/
├── (dashboard)/
│   ├── competitors/          # List, create, edit, data, insights pages
│   ├── criteria/             # Criteria tree management
│   ├── settings/             # AI provider settings
│   └── layout.tsx            # Sidebar shell
├── api/scans/route.ts        # Scan API — crawl, research, SSE streaming
└── login/                    # Auth pages

components/
├── layout/Sidebar.tsx
├── ui/badge.tsx
├── competitors/
│   ├── CompetitorCard.tsx    # Split scan button, progress, stop
│   └── CompetitorForm.tsx
├── criteria/CriteriaManager.tsx
└── settings/SettingsForm.tsx

lib/
├── supabase/                 # Client, server, service-role clients + types
├── actions/                  # Server actions (competitors, criteria, auth)
├── ai/
│   ├── client.ts             # callAI() — routes to Claude or Gemini
│   ├── classify.ts           # Page relevance classification
│   ├── extract.ts            # Data point extraction with fuzzy criteria matching
│   ├── insights.ts           # Executive summary generation
│   ├── gemini.ts             # Google Gemini SDK wrapper
│   └── prompts.ts            # All AI prompt templates
├── crawler/
│   ├── fetch.ts              # Direct fetch + Jina Reader fallback
│   ├── clean.ts              # HTML/Markdown content cleaning
│   ├── urls.ts               # URL normalisation + internal link extraction
│   └── index.ts              # Full crawl orchestration
├── research/
│   ├── agent.ts              # Anthropic web_search agent + Gemini research
│   └── prompts.ts            # Research system/user prompts
├── scan/index.ts             # runScanForCompetitor, runResearchForCompetitor
├── settings.ts               # AI provider settings with 60s cache
└── data-points.ts            # Data point grouping by criteria category

supabase/migrations/
├── 0001_initial_schema.sql
├── 0002_rls_policies.sql
└── 0003_settings.sql         # AI provider settings table

tests/
├── ai/parseJSON.test.ts
├── crawler/clean.test.ts
├── crawler/hash.test.ts
├── crawler/urls.test.ts
├── diff/chunker.test.ts
└── diff/engine.test.ts
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
| `scans` | One scan run per competitor |
| `pages` | URL snapshots with content hash for diffing |
| `change_events` | Diffs between scans |
| `data_points` | Structured AI output: one value per competitor × criteria |
| `insights` | AI narratives: summaries, recommendations, benchmarks |
| `settings` | App-wide config (AI provider choice) |

---

## Local setup

### 1. Clone and install

```bash
git clone <repo-url>
cd competitor-intelligence-scanner
npm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a project, then copy credentials from **Settings → API**.

### 3. Configure environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-...

# Optional — only needed if using Google Gemini
GEMINI_API_KEY=AIzaSy...
```

> The `GEMINI_API_KEY` is never stored in the database. It is only read from the server environment.

### 4. Run database migrations

In Supabase → **SQL Editor**, run in order:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`
3. `supabase/migrations/0003_settings.sql`

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Run tests

```bash
npm test
```

---

## AI provider setup

### Anthropic Claude (default)
Set `ANTHROPIC_API_KEY` in `.env.local`. No other configuration needed.

### Google Gemini
1. Get an API key from [Google AI Studio](https://aistudio.google.com)
2. Enable billing on the associated Google Cloud project
3. Set `GEMINI_API_KEY` in `.env.local`
4. Switch to Gemini in **Settings** within the app

---

## Architecture decisions

**Jina Reader fallback** — Modern fintech sites are React/Vue SPAs that return empty HTML shells to static fetchers. When a direct fetch returns less than 5KB, the crawler falls back to `https://r.jina.ai/{url}`, which renders the page with a headless browser and returns clean Markdown. PDF URLs are sent directly to Jina.

**Dual scan modes** — Crawl is cheap (~$0.007) but only works on static content. Research uses an AI agent with web search, finding fee tables, press releases, and third-party sources that a crawler would miss. Research defaults to on given most fintech sites are SPAs.

**Fuzzy criteria matching** — AI-generated criteria names sometimes differ in capitalisation or punctuation from the stored names. Exact lookup is tried first; if it fails, a case-insensitive fallback prevents data points from being silently dropped.

**SSE progress streaming** — Research scans stream Server-Sent Events so the UI shows real-time turn count, current search query, and elapsed time instead of a blank spinner.

**Diff-based processing** — Only pages whose content hash changed since the last scan are sent to AI for classification. This keeps costs low as the competitor count grows.

**RLS split** — Authenticated users can read all tables. Only the service-role key (server-side only) can write to pipeline tables. Browser code never touches pipeline data directly.

**API keys in environment only** — Sensitive keys (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`) are never stored in the database. The Settings page stores only the provider choice (`anthropic` | `gemini`).

---

## Deployment

Deploy to Vercel:

```bash
npm i -g vercel
vercel
```

Add all environment variables from `.env.local` in the Vercel project settings under **Environment Variables**.

> Note: Vercel Hobby has a 10s function timeout. Research scans can take 30–60s. Use Vercel Pro (60s limit) or run scans from the CLI with `npm run scan` for production use.
