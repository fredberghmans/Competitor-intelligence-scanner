-- =============================================================
-- 0001_initial_schema.sql
-- Competitor Intelligence Scanner — core tables
-- =============================================================

create extension if not exists "uuid-ossp";

-- -------------------------------------------------------------
-- COMPETITORS
-- Each competitor is a company we track, with one or more URLs.
-- domains is a JSONB array: [{ "url": "...", "label": "..." }]
-- -------------------------------------------------------------
create table competitors (
  id          uuid        primary key default uuid_generate_v4(),
  name        text        not null,
  type        text        not null check (type in ('crypto_exchange', 'bank', 'hybrid')),
  region      text        not null,
  domains     jsonb       not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- -------------------------------------------------------------
-- CRITERIA
-- Self-referential tree: category rows (parent_id IS NULL)
-- hold subcriteria rows (parent_id = category.id).
-- position controls display order within a parent.
--
-- Example:
--   Trading (parent_id = null)
--   ├── Spot       (parent_id = Trading.id)
--   ├── Fees       (parent_id = Trading.id)
--   └── Derivatives (parent_id = Trading.id)
-- -------------------------------------------------------------
create table criteria (
  id          uuid        primary key default uuid_generate_v4(),
  name        text        not null,
  category    text        not null,
  parent_id   uuid        references criteria(id) on delete cascade,
  position    integer     not null default 0,
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------------
-- SCANS
-- One scan = one crawl run for one competitor.
-- Multiple pages are collected per scan.
-- -------------------------------------------------------------
create table scans (
  id            uuid        primary key default uuid_generate_v4(),
  competitor_id uuid        not null references competitors(id) on delete cascade,
  status        text        not null default 'pending'
                            check (status in ('pending', 'running', 'completed', 'failed')),
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- -------------------------------------------------------------
-- PAGES
-- One row = one URL snapshot captured during a scan.
-- content_hash enables change detection: compare hash with the
-- previous scan's hash for the same URL before sending to AI.
-- raw_html / cleaned_text are kept for diffing and audit trail.
-- -------------------------------------------------------------
create table pages (
  id            uuid        primary key default uuid_generate_v4(),
  competitor_id uuid        not null references competitors(id) on delete cascade,
  scan_id       uuid        not null references scans(id) on delete cascade,
  url           text        not null,
  content_hash  text        not null,
  raw_html      text,
  cleaned_text  text,
  scanned_at    timestamptz not null default now()
);

-- -------------------------------------------------------------
-- CHANGE_EVENTS
-- Created when a page hash differs from the previous scan.
-- This is the trigger for AI processing (diff-based cost control).
-- diff_summary is a human-readable description of what changed.
-- -------------------------------------------------------------
create table change_events (
  id           uuid        primary key default uuid_generate_v4(),
  page_id      uuid        not null references pages(id) on delete cascade,
  scan_id      uuid        not null references scans(id) on delete cascade,
  change_type  text        not null
               check (change_type in ('new_page', 'content_changed', 'removed')),
  diff_summary text,
  created_at   timestamptz not null default now()
);

-- -------------------------------------------------------------
-- DATA_POINTS
-- Structured AI output: one value per (competitor × criteria).
-- confidence mirrors the PRD: high=explicit, medium=inferred, low=external.
-- source_url links back to the page the value was extracted from.
-- Updated on each scan that finds a change; previous value is overwritten
-- (use change_events + insights for history).
-- -------------------------------------------------------------
create table data_points (
  id            uuid        primary key default uuid_generate_v4(),
  competitor_id uuid        not null references competitors(id) on delete cascade,
  criteria_id   uuid        not null references criteria(id) on delete cascade,
  scan_id       uuid        references scans(id) on delete set null,
  value         text        not null,
  confidence    text        not null check (confidence in ('high', 'medium', 'low')),
  source_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (competitor_id, criteria_id)           -- one current value per pair
);

-- -------------------------------------------------------------
-- INSIGHTS
-- AI-generated narrative outputs, scoped per competitor.
-- type drives which UI view renders the insight:
--   executive_summary   → overview card
--   strategic_recommendation → recommendations panel
--   change_highlight    → changelog / timeline
--   benchmark           → decision engine ("you are behind X by...")
-- -------------------------------------------------------------
create table insights (
  id            uuid        primary key default uuid_generate_v4(),
  competitor_id uuid        not null references competitors(id) on delete cascade,
  scan_id       uuid        references scans(id) on delete set null,
  type          text        not null
                check (type in (
                  'executive_summary',
                  'strategic_recommendation',
                  'change_highlight',
                  'benchmark'
                )),
  content       text        not null,
  created_at    timestamptz not null default now()
);

-- =============================================================
-- INDEXES
-- =============================================================

-- Fetch latest scan for a competitor
create index idx_scans_competitor_created    on scans (competitor_id, created_at desc);

-- Deduplicate pages by URL across scans (change detection query)
create index idx_pages_competitor_url        on pages (competitor_id, url);
create index idx_pages_scan                  on pages (scan_id);

-- Find all change events in a scan
create index idx_change_events_scan          on change_events (scan_id);

-- Comparison view: all data points for a set of competitors × criteria
create index idx_data_points_competitor      on data_points (competitor_id);
create index idx_data_points_criteria        on data_points (criteria_id);

-- Timeline / changelog
create index idx_insights_competitor_created on insights (competitor_id, created_at desc);

-- =============================================================
-- TRIGGERS — keep updated_at current
-- =============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger competitors_set_updated_at
  before update on competitors
  for each row execute function set_updated_at();

create trigger data_points_set_updated_at
  before update on data_points
  for each row execute function set_updated_at();
