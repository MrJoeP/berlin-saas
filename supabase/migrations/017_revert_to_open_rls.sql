-- Migration 017: zurück zum "kein Login" Modus.
-- Droppt die Auth-basierten Policies aus 016 und stellt open_all wieder her.
-- Hintergrund: Personal Tool, ein User, kein Login geplant.

drop policy if exists "companies_own" on public.companies;
drop policy if exists "competitors_via_company" on public.competitors;
drop policy if exists "jobs_select_via_company" on public.jobs;
drop policy if exists "jobs_insert_via_company" on public.jobs;
drop policy if exists "digests_via_company" on public.digests;
drop policy if exists "digest_items_via_digest" on public.digest_items;
drop policy if exists "knowledge_entries_via_company" on public.knowledge_entries;
drop policy if exists "company_sources_via_company" on public.company_sources;
drop policy if exists "industries_read" on public.industries;
drop policy if exists "sources_read" on public.sources;

create policy "open_all" on companies for all using (true) with check (true);
create policy "open_all" on digests for all using (true) with check (true);
create policy "open_all" on digest_items for all using (true) with check (true);
create policy "open_all" on jobs for all using (true) with check (true);
create policy "open_all" on knowledge_entries for all using (true) with check (true);
create policy "open_all" on company_sources for all using (true) with check (true);
create policy "open_all" on competitors for all using (true) with check (true);
create policy "open_all" on industries for all using (true) with check (true);
create policy "open_all" on sources for all using (true) with check (true);
