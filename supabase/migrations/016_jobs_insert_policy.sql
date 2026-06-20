-- Migration 016: INSERT-Policy für jobs (authenticated User)
-- Vorbereitung: die "open_all" Policies aus 010 (Personal-Tool-Modus) droppen
-- und die Original-Auth-Policies aus 008 wiederherstellen, damit jobs_insert_via_company
-- tatsächlich greifen kann (sonst überschreibt open_all alles).

-- Cleanup: open_all Policies aus Migration 010 entfernen.
drop policy if exists "open_all" on companies;
drop policy if exists "open_all" on digests;
drop policy if exists "open_all" on digest_items;
drop policy if exists "open_all" on jobs;
drop policy if exists "open_all" on knowledge_entries;
drop policy if exists "open_all" on company_sources;
drop policy if exists "open_all" on competitors;
drop policy if exists "open_all" on industries;
drop policy if exists "open_all" on sources;

-- 008-Policies wiederherstellen (vorher droppen falls sie noch existieren).
drop policy if exists "companies_own" on public.companies;
drop policy if exists "competitors_via_company" on public.competitors;
drop policy if exists "jobs_select_via_company" on public.jobs;
drop policy if exists "digests_via_company" on public.digests;
drop policy if exists "digest_items_via_digest" on public.digest_items;
drop policy if exists "knowledge_entries_via_company" on public.knowledge_entries;
drop policy if exists "company_sources_via_company" on public.company_sources;

create policy "companies_own"
  on public.companies for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "competitors_via_company"
  on public.competitors for all to authenticated
  using (exists (select 1 from public.companies c where c.id = competitors.company_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.companies c where c.id = competitors.company_id and c.user_id = auth.uid()));

create policy "jobs_select_via_company"
  on public.jobs for select to authenticated
  using (
    company_id is null or
    exists (select 1 from public.companies c where c.id = jobs.company_id and c.user_id = auth.uid())
  );

create policy "digests_via_company"
  on public.digests for select to authenticated
  using (exists (select 1 from public.companies c where c.id = digests.company_id and c.user_id = auth.uid()));

create policy "digest_items_via_digest"
  on public.digest_items for select to authenticated
  using (
    exists (
      select 1 from public.digests d
      join public.companies c on c.id = d.company_id
      where d.id = digest_items.digest_id and c.user_id = auth.uid()
    )
  );

create policy "knowledge_entries_via_company"
  on public.knowledge_entries for select to authenticated
  using (exists (select 1 from public.companies c where c.id = knowledge_entries.company_id and c.user_id = auth.uid()));

create policy "company_sources_via_company"
  on public.company_sources for all to authenticated
  using (exists (select 1 from public.companies c where c.id = company_sources.company_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.companies c where c.id = company_sources.company_id and c.user_id = auth.uid()));

-- Master-Tabellen (industries, sources) bleiben für alle authenticated lesbar.
drop policy if exists "industries_read" on public.industries;
drop policy if exists "sources_read" on public.sources;
create policy "industries_read" on public.industries for select to authenticated using (true);
create policy "sources_read" on public.sources for select to authenticated using (true);

-- Die eigentliche neue Policy aus dem FIX Brief.
create policy "jobs_insert_via_company"
  on public.jobs
  for insert
  to authenticated
  with check (
    company_id is null or
    exists (
      select 1 from public.companies c
      where c.id = jobs.company_id
        and c.user_id = auth.uid()
    )
  );
