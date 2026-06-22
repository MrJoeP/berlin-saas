-- Migration 022: Auth zurück + unified Votes-Tabelle.
-- open_all RLS Policies droppen, Auth-basierte Policies wiederherstellen.
-- Alte upvotes/downvotes-Counter und digest_cluster_votes Tabelle weg.
-- Neue votes-Tabelle: 1 User → max 1 Vote pro Target (Item oder Cluster).

drop policy if exists "open_all" on companies;
drop policy if exists "open_all" on digests;
drop policy if exists "open_all" on digest_items;
drop policy if exists "open_all" on jobs;
drop policy if exists "open_all" on knowledge_entries;
drop policy if exists "open_all" on company_sources;
drop policy if exists "open_all" on competitors;
drop policy if exists "open_all" on industries;
drop policy if exists "open_all" on sources;
drop policy if exists "open_all" on article_bodies;
drop policy if exists "open_all" on digest_cluster_votes;

drop policy if exists "companies_own" on public.companies;
create policy "companies_own"
  on public.companies for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "competitors_via_company" on public.competitors;
create policy "competitors_via_company"
  on public.competitors for all to authenticated
  using (exists (select 1 from public.companies c where c.id = competitors.company_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.companies c where c.id = competitors.company_id and c.user_id = auth.uid()));

drop policy if exists "jobs_select_via_company" on public.jobs;
create policy "jobs_select_via_company"
  on public.jobs for select to authenticated
  using (
    company_id is null or
    exists (select 1 from public.companies c where c.id = jobs.company_id and c.user_id = auth.uid())
  );

drop policy if exists "jobs_insert_via_company" on public.jobs;
create policy "jobs_insert_via_company"
  on public.jobs for insert to authenticated
  with check (
    company_id is null or
    exists (select 1 from public.companies c where c.id = jobs.company_id and c.user_id = auth.uid())
  );

drop policy if exists "digests_via_company" on public.digests;
create policy "digests_via_company"
  on public.digests for select to authenticated
  using (exists (select 1 from public.companies c where c.id = digests.company_id and c.user_id = auth.uid()));

drop policy if exists "digest_items_via_digest" on public.digest_items;
create policy "digest_items_via_digest"
  on public.digest_items for select to authenticated
  using (exists (
    select 1 from public.digests d
    join public.companies c on c.id = d.company_id
    where d.id = digest_items.digest_id and c.user_id = auth.uid()
  ));

drop policy if exists "knowledge_entries_via_company" on public.knowledge_entries;
create policy "knowledge_entries_via_company"
  on public.knowledge_entries for select to authenticated
  using (exists (select 1 from public.companies c where c.id = knowledge_entries.company_id and c.user_id = auth.uid()));

drop policy if exists "company_sources_via_company" on public.company_sources;
create policy "company_sources_via_company"
  on public.company_sources for all to authenticated
  using (exists (select 1 from public.companies c where c.id = company_sources.company_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.companies c where c.id = company_sources.company_id and c.user_id = auth.uid()));

drop policy if exists "industries_read" on public.industries;
create policy "industries_read" on public.industries for select to authenticated using (true);

drop policy if exists "sources_read" on public.sources;
create policy "sources_read" on public.sources for select to authenticated using (true);

drop policy if exists "article_bodies_read" on public.article_bodies;
create policy "article_bodies_read" on public.article_bodies for select to authenticated using (true);

alter table digest_items drop column if exists upvotes;
alter table digest_items drop column if exists downvotes;
drop table if exists digest_cluster_votes;

create table public.votes (
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('item', 'cluster')),
  target_id text not null,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz default now(),
  primary key (user_id, target_type, target_id)
);
create index idx_votes_target on votes(target_type, target_id, value);

alter table votes enable row level security;
create policy "votes_own" on votes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

comment on table votes is 'Single up/down vote pro User pro Target. Toggle: 2. Klick = delete.';
