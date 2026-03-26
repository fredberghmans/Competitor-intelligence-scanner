# Competitor Intelligence Scanner — Claude Code Guide

## Project Overview

AI-powered competitor monitoring system for a crypto exchange / fintech company. Tracks competitors by crawling their websites and extracting structured intelligence (fees, features, rates) against a predefined criteria tree. The system generates insights, benchmarks, and strategic recommendations.

**Working directory:** `/Users/fredericberghmans/Desktop/Competitor intelligence scanner/`

---

## Tech Stack

- **Frontend/Backend:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Database:** Supabase (Postgres) with Row Level Security
- **AI:** Anthropic Claude (default) or Google Gemini (configurable per-instance in settings)
- **Crawling:** Custom crawler with Jina Reader fallback for JS-heavy pages
- **Auth:** Supabase Auth

---

## Architecture

### Scanning Modes

There are two scan modes, triggered via `POST /api/scans?mode=`:

**`crawl` (default)** — Deterministic web scraping:
```
Crawl domains → hash-diff pages → extract changed chunks → classify → extract data points → insights
```

**`research`** — Agentic web search (preferred — gives better results):
```
Gemini 2.5 Pro + Google Search grounding → extract data points → insights
```
The research mode uses `researchWithGemini()` from `lib/ai/gemini.ts`. It's preferred over crawl for JS-heavy sites or when crawl returns no results. Set `mode=research` when triggering scans.

**`both`** — Runs crawl then research sequentially.

### AI Pipeline (Crawl Mode)

Three stages, all using `callAI()` which routes to Anthropic or Gemini based on DB settings:

| Stage | Model | File | Purpose |
|---|---|---|---|
| 1. Classify | `cheap` (Haiku / Gemini Flash) | `lib/ai/classify.ts` | Match chunks to criteria |
| 2. Extract | `cheap` | `lib/ai/extract.ts` | Pull structured data points |
| 3. Insights | `advanced` (Sonnet / Gemini Pro) | `lib/ai/insights.ts` | Executive summary, benchmarks, recommendations |
| 4. Normalize | `cheap` | `lib/ai/normalize.ts` | Canonical display values for compare page |

### Cost Model — Critical

- **Only process changed pages.** Hash-diff prevents AI calls on unchanged content.
- **Never add AI calls outside of the pipeline stages above.** All AI calls go through `callAI()`.
- **Normalization runs per-criteria, not per-cell.** One Haiku call per affected criterion after a scan.
- Typical scan cost: ~$0.007 (Anthropic) or near-free (Gemini free tier).

---

## Key Data Model

```
competitors          — companies being tracked (with JSONB domains[])
criteria             — self-referential tree: category → subcriteria
scans                — one run per competitor, status lifecycle
pages                — URL snapshots, content_hash for change detection
change_events        — diffs between consecutive scans
data_points          — one value per (competitor × criteria), unique constraint
  ├── value          — raw extracted value, NEVER modified after write
  └── normalized_value — AI canonical form for compare page display, nullable
insights             — AI narrative outputs (executive_summary, benchmark, etc.)
```

**Critical constraints:**
- `data_points` has `UNIQUE (competitor_id, criteria_id)` — upsert, never insert duplicates
- `value` is immutable source-of-truth — only `normalized_value` is updated post-extraction
- `insights` always inserts new rows (no upsert) — history is preserved

---

## File Structure

```
app/
├── (dashboard)/          # All authenticated views
│   ├── compare/          # Pivot table: competitors × criteria
│   ├── competitors/      # CRUD + detail + data points + insights
│   ├── criteria/         # Criteria tree management
│   └── changelog/        # Change log timeline
├── api/
│   ├── scans/            # POST — trigger scans (crawl/research/both)
│   └── normalize/        # POST — backfill normalized_value (one-time bootstrap)
lib/
├── ai/
│   ├── client.ts         # callAI(), parseJSON(), log(), MODELS
│   ├── classify.ts       # Stage 1
│   ├── extract.ts        # Stage 2
│   ├── insights.ts       # Stage 3
│   ├── normalize.ts      # Normalization (post-upsert, per-criteria)
│   ├── store.ts          # saveDataPoints() — triggers normalization
│   ├── prompts.ts        # ALL prompt functions live here
│   ├── gemini.ts         # Gemini provider (callGemini, researchWithGemini)
│   └── cache.ts          # In-memory cache for repeated chunks
├── research/
│   └── agent.ts          # researchCompetitor() — Gemini/Claude agentic search
├── scan/
│   └── index.ts          # runScanForCompetitor(), runResearchForCompetitor()
├── crawler/              # Web scraper + Jina fallback
├── diff/                 # Hash + paragraph diff engine
└── supabase/
    ├── types.ts          # Hand-written TypeScript types (source of truth)
    ├── client.ts         # Browser Supabase client
    └── server.ts         # Server client — createClient() and createServiceClient()
supabase/migrations/      # SQL migrations (apply via Supabase Studio or supabase db push)
```

---

## Development Practices

### AI Calls
- **Always use `callAI(modelKey, system, user, maxTokens)`** — never call Anthropic or Gemini SDKs directly. This ensures provider routing (Anthropic vs Gemini) works correctly.
- **Always use `parseJSON<T>(raw)`** from `client.ts` to parse AI responses — handles markdown fences and trailing prose.
- **All prompts go in `lib/ai/prompts.ts`** — one file, clearly sectioned.
- Use `cheap` for structured extraction tasks, `advanced` for reasoning/narrative.
- Wrap AI calls in try/catch when they are non-critical (e.g. normalization). Never let normalization failure abort a scan.

### Supabase
- **Backend writes use `createServiceClient()`** (service role key). Never use the anon client for inserts/updates in API routes.
- **Frontend reads use `createClient()`** (anon key + RLS).
- TypeScript types are in `lib/supabase/types.ts` — update this file whenever the schema changes.
- After adding a migration, apply it via Supabase Studio (paste SQL → Run) or `supabase db push`.

### API Routes
- All routes authenticate via `createClient().auth.getUser()` before doing anything.
- Return `{ ok: false, error: '...' }` with appropriate HTTP status on failure.
- Non-critical background work (normalization, insights) uses try/catch and never throws after the primary operation succeeds.

### Data Integrity
- `data_points.value` is immutable after extraction — it is the audit trail. Only `normalized_value` is updated.
- Every data point must have a `source_url` — traceability is required.
- Criteria names from AI are fuzzy-matched to DB IDs. Unmatched data points are skipped (not saved).

### TypeScript
- Use `@/` path alias for all imports (e.g. `@/lib/supabase/types`).
- Avoid `any`. Use the types from `lib/supabase/types.ts` and `lib/ai/types.ts`.
- Keep `lib/supabase/types.ts` in sync with the DB schema — it's hand-written (no codegen yet).

---

## Running Scans

**From browser console (while logged into the app on localhost:3000):**

```js
// Research mode (preferred — uses Gemini + Google Search)
fetch('/api/scans?mode=research', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ competitorId: '<uuid>' })
}).then(r => r.json()).then(console.log)

// Force re-scan all (ignores unchanged hash)
fetch('/api/scans?force=true', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({})
}).then(r => r.json()).then(console.log)

// Backfill normalized_value for existing data points
fetch('/api/normalize', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({})
}).then(r => r.json()).then(console.log)
```

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=          # Default AI provider
GEMINI_API_KEY=             # Required for research mode (Gemini + Google Search)
```

The active AI provider is stored in the Supabase `settings` table and can be changed via the Settings UI. Gemini is preferred for research; both providers are supported for all pipeline stages.

---

## Adding New Features

**New criteria:** Add via the Criteria UI. The AI pipeline reads criteria from the DB — no code changes needed.

**New AI stage:** Add a prompt function to `prompts.ts`, implement the stage in `lib/ai/`, call `callAI()`. Wire into the pipeline orchestrator in `lib/ai/index.ts`.

**New DB column:** Write a migration in `supabase/migrations/`, apply it, update `lib/supabase/types.ts`.

**New scan mode:** Add a handler in `lib/scan/index.ts` and expose it via the `mode` query param in `app/api/scans/route.ts`.
