-- Personal-Tool-Modus: kein Auth-Login, alle Tabellen für anon-Role öffnen.
-- Auth-basierte Policies droppen, permissive "open_all" Policies setzen.

drop policy if exists "Users can read own company" on companies;
drop policy if exists "Users can insert own company" on companies;
drop policy if exists "Users can update own company" on companies;
drop policy if exists "Users own company" on companies;
drop policy if exists "companies_select" on companies;
drop policy if exists "companies_insert" on companies;
drop policy if exists "companies_update" on companies;

drop policy if exists "Users can read own digests" on digests;
drop policy if exists "digests_select" on digests;
drop policy if exists "digests_insert" on digests;

drop policy if exists "digest_items_select" on digest_items;
drop policy if exists "digest_items_insert" on digest_items;

drop policy if exists "jobs_select" on jobs;
drop policy if exists "jobs_insert" on jobs;
drop policy if exists "jobs_update" on jobs;

drop policy if exists "knowledge_entries_select" on knowledge_entries;
drop policy if exists "knowledge_entries_insert" on knowledge_entries;

drop policy if exists "company_sources_select" on company_sources;
drop policy if exists "company_sources_insert" on company_sources;

drop policy if exists "competitors_select" on competitors;
drop policy if exists "competitors_insert" on competitors;

drop policy if exists "industries_select" on industries;
drop policy if exists "sources_select" on sources;

create policy "open_all" on companies for all using (true) with check (true);
create policy "open_all" on digests for all using (true) with check (true);
create policy "open_all" on digest_items for all using (true) with check (true);
create policy "open_all" on jobs for all using (true) with check (true);
create policy "open_all" on knowledge_entries for all using (true) with check (true);
create policy "open_all" on company_sources for all using (true) with check (true);
create policy "open_all" on competitors for all using (true) with check (true);
create policy "open_all" on industries for all using (true) with check (true);
create policy "open_all" on sources for all using (true) with check (true);
