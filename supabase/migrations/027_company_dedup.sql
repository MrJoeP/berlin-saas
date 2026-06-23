-- Migration 027: Company-Dedup
-- Problem: dieselbe Firma wird mehrfach angelegt, weil die URL unterschiedliche
-- Query-Parameter trägt (z.B. ?gad_source=...&gclid=...). Der Roh-String unterscheidet
-- sich, die Firma ist aber dieselbe. Lösung: auf die nackte Domain normalisieren,
-- Dubletten erkennen, und eine Merge-Funktion die zwei Firmen sauber zusammenführt.

-- ── 1. Domain-Normalisierung ────────────────────────────────────────────────
-- IMMUTABLE, damit sie in einem Index/Unique-Constraint nutzbar ist.
-- https://www.buzzmatic.net/?gad_source=1&gclid=...  →  buzzmatic.net
create or replace function public.normalize_domain(url text)
returns text
language sql
immutable
as $$
  select nullif(
    split_part(                                   -- 3. alles vor dem ? (Query weg)
      split_part(                                 -- 2. alles vor dem ersten / (Pfad weg)
        regexp_replace(
          regexp_replace(lower(btrim(coalesce(url, ''))), '^https?://', ''),  -- Protokoll weg
          '^www\.', ''                            -- www. weg
        ),
        '/', 1
      ),
      '?', 1
    ),
    ''
  )
$$;

comment on function public.normalize_domain(text) is
  'Reduziert eine URL auf die nackte Domain für Dubletten-Vergleich. IMMUTABLE für Index-Nutzung.';

-- ── 2. Dubletten-Erkennung ──────────────────────────────────────────────────
-- Gruppiert je Konto nach normalisierter Domain. group_size > 1 = Dublette.
create or replace view public.company_duplicate_candidates as
select
  c.user_id,
  c.id          as company_id,
  c.name,
  c.url,
  c.created_at,
  public.normalize_domain(c.url)                                              as domain,
  count(*)      over (partition by c.user_id, public.normalize_domain(c.url)) as domain_group_size,
  (select count(*) from public.company_sources cs
     where cs.company_id = c.id and cs.active)                               as active_sources,
  (select count(*) from public.digests d where d.company_id = c.id)          as digests,
  (select max(d.generated_at) from public.digests d where d.company_id = c.id) as latest_digest
from public.companies c
where public.normalize_domain(c.url) is not null;

comment on view public.company_duplicate_candidates is
  'Pro Konto nach Domain gruppierte Firmen. Zeilen mit domain_group_size > 1 sind Dubletten.';

-- ── 3. Merge-Funktion ───────────────────────────────────────────────────────
-- Hängt alle Kind-Daten von drop_id an keep_id um, dann löscht drop_id.
-- Ownership-Guard: beide Firmen müssen dem aufrufenden Konto gehören
-- (auth.uid() is null erlaubt service_role / SQL-Editor).
create or replace function public.merge_companies(keep_id uuid, drop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if keep_id = drop_id then
    raise exception 'merge_companies: keep_id und drop_id sind identisch';
  end if;

  if not exists (
        select 1 from public.companies
        where id = keep_id and (user_id = auth.uid() or auth.uid() is null))
     or not exists (
        select 1 from public.companies
        where id = drop_id and (user_id = auth.uid() or auth.uid() is null)) then
    raise exception 'merge_companies: beide Firmen müssen dem aufrufenden Konto gehören';
  end if;

  -- Kind-Daten umhängen. digest_items/votes bleiben gültig, da digest- und item-IDs stabil sind.
  update public.digests           set company_id = keep_id where company_id = drop_id;
  update public.jobs              set company_id = keep_id where company_id = drop_id;
  update public.knowledge_entries set company_id = keep_id where company_id = drop_id;
  update public.competitors       set company_id = keep_id where company_id = drop_id;

  -- company_sources: PK ist (company_id, source_id) → Kollision vermeiden.
  insert into public.company_sources (company_id, source_id, active)
    select keep_id, source_id, active
    from public.company_sources
    where company_id = drop_id
  on conflict (company_id, source_id) do nothing;
  delete from public.company_sources where company_id = drop_id;

  delete from public.companies where id = drop_id;
end;
$$;

revoke all on function public.merge_companies(uuid, uuid) from public;
grant execute on function public.merge_companies(uuid, uuid) to authenticated;

comment on function public.merge_companies(uuid, uuid) is
  'Führt drop_id in keep_id zusammen: Digests, Jobs, Knowledge, Competitors, Sources umhängen, dann drop_id löschen.';

-- ── 4. Prävention (optional, ERST nach manueller Bereinigung aktivieren) ─────
-- Verhindert künftige Domain-Dubletten pro Konto auf DB-Ebene.
-- Auskommentiert, weil bestehende Dubletten den Index-Aufbau sonst sprengen.
-- create unique index if not exists uq_companies_user_domain
--   on public.companies (user_id, public.normalize_domain(url))
--   where url is not null;
