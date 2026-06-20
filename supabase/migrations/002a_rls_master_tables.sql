-- Migration 002a: RLS auf Master-Tables
-- Read-only für authenticated. Service-Role hat default Voll-Zugriff.

alter table public.industries enable row level security;
alter table public.sources enable row level security;

create policy "industries_read_authenticated"
  on public.industries
  for select
  to authenticated
  using (true);

create policy "sources_read_authenticated"
  on public.sources
  for select
  to authenticated
  using (true);

comment on policy "industries_read_authenticated" on public.industries is 'Read-only für alle eingeloggten User. Schreibzugriff nur via Service-Role.';
comment on policy "sources_read_authenticated" on public.sources is 'Read-only für alle eingeloggten User. Schreibzugriff nur via Service-Role.';
