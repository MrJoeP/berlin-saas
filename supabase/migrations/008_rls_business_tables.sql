-- Migration 008: RLS für Business-Tables
-- User sieht nur Records seiner eigenen Company. Service-Role hat default Voll-Zugriff.

alter table public.companies enable row level security;
alter table public.competitors enable row level security;
alter table public.jobs enable row level security;
alter table public.digests enable row level security;
alter table public.digest_items enable row level security;
alter table public.knowledge_entries enable row level security;
alter table public.company_sources enable row level security;

create policy "companies_own"
  on public.companies
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "competitors_via_company"
  on public.competitors
  for all
  to authenticated
  using (exists (select 1 from public.companies c where c.id = competitors.company_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.companies c where c.id = competitors.company_id and c.user_id = auth.uid()));

create policy "jobs_select_via_company"
  on public.jobs
  for select
  to authenticated
  using (
    company_id is null or
    exists (select 1 from public.companies c where c.id = jobs.company_id and c.user_id = auth.uid())
  );

create policy "digests_via_company"
  on public.digests
  for select
  to authenticated
  using (exists (select 1 from public.companies c where c.id = digests.company_id and c.user_id = auth.uid()));

create policy "digest_items_via_digest"
  on public.digest_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.digests d
      join public.companies c on c.id = d.company_id
      where d.id = digest_items.digest_id and c.user_id = auth.uid()
    )
  );

create policy "knowledge_entries_via_company"
  on public.knowledge_entries
  for select
  to authenticated
  using (exists (select 1 from public.companies c where c.id = knowledge_entries.company_id and c.user_id = auth.uid()));

create policy "company_sources_via_company"
  on public.company_sources
  for all
  to authenticated
  using (exists (select 1 from public.companies c where c.id = company_sources.company_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.companies c where c.id = company_sources.company_id and c.user_id = auth.uid()));
