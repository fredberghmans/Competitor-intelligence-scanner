-- =============================================================
-- 0002_rls_policies.sql
-- Row Level Security — all tables locked to authenticated users.
-- Extend this when you add multi-tenancy (org_id column + policy).
-- =============================================================

alter table competitors    enable row level security;
alter table criteria       enable row level security;
alter table scans          enable row level security;
alter table pages          enable row level security;
alter table change_events  enable row level security;
alter table data_points    enable row level security;
alter table insights       enable row level security;

-- -------------------------------------------------------------
-- COMPETITORS
-- -------------------------------------------------------------
create policy "competitors: authenticated read"
  on competitors for select
  to authenticated using (true);

create policy "competitors: authenticated write"
  on competitors for all
  to authenticated using (true) with check (true);

-- -------------------------------------------------------------
-- CRITERIA
-- -------------------------------------------------------------
create policy "criteria: authenticated read"
  on criteria for select
  to authenticated using (true);

create policy "criteria: authenticated write"
  on criteria for all
  to authenticated using (true) with check (true);

-- -------------------------------------------------------------
-- SCANS
-- -------------------------------------------------------------
create policy "scans: authenticated read"
  on scans for select
  to authenticated using (true);

create policy "scans: authenticated write"
  on scans for all
  to authenticated using (true) with check (true);

-- -------------------------------------------------------------
-- PAGES (large data — read-only from UI, written by backend)
-- -------------------------------------------------------------
create policy "pages: authenticated read"
  on pages for select
  to authenticated using (true);

create policy "pages: service role write"
  on pages for all
  to service_role using (true) with check (true);

-- -------------------------------------------------------------
-- CHANGE_EVENTS
-- -------------------------------------------------------------
create policy "change_events: authenticated read"
  on change_events for select
  to authenticated using (true);

create policy "change_events: service role write"
  on change_events for all
  to service_role using (true) with check (true);

-- -------------------------------------------------------------
-- DATA_POINTS
-- -------------------------------------------------------------
create policy "data_points: authenticated read"
  on data_points for select
  to authenticated using (true);

create policy "data_points: service role write"
  on data_points for all
  to service_role using (true) with check (true);

-- -------------------------------------------------------------
-- INSIGHTS
-- -------------------------------------------------------------
create policy "insights: authenticated read"
  on insights for select
  to authenticated using (true);

create policy "insights: service role write"
  on insights for all
  to service_role using (true) with check (true);
