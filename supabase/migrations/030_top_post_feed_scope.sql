-- Migration 030: Feed-Scope für Custom-Quellen.
-- Erlaubt es, eine Custom-RSS-Source gezielt einem Tool zuzuordnen:
--   'niche_news' (Default, bisheriges Verhalten) | 'top_post' (Published Content) | 'both'.
-- scrape-news überspringt 'top_post'-Quellen, top-post-scrape zieht 'top_post'/'both'.

drop function if exists public.add_company_rss_source(uuid, text, text);

create or replace function public.add_company_rss_source(
  p_company_id uuid,
  p_name text,
  p_url text,
  p_feed_scope text default 'niche_news'
)
returns public.company_sources
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_id uuid;
  v_company_source public.company_sources;
  v_name text := nullif(btrim(p_name), '');
  v_url text := nullif(btrim(p_url), '');
  v_scope text := coalesce(nullif(btrim(p_feed_scope), ''), 'niche_news');
  v_industry text;
begin
  if v_name is null then
    raise exception 'Source-Name fehlt';
  end if;

  if v_url is null or v_url !~* '^https?://' then
    raise exception 'RSS-URL muss mit http:// oder https:// beginnen';
  end if;

  if v_scope not in ('niche_news', 'top_post', 'both') then
    raise exception 'Ungültiger feed_scope: %', v_scope;
  end if;

  select industry into v_industry
  from public.companies
  where id = p_company_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Company nicht gefunden oder kein Zugriff';
  end if;

  insert into public.sources (
    name,
    url,
    type,
    industry_tags,
    config,
    is_default,
    tier,
    min_score,
    max_age_days
  )
  values (
    v_name,
    v_url,
    'rss',
    case when v_industry is null then '{}'::text[] else array[v_industry] end,
    jsonb_build_object('custom', true, 'feed_scope', v_scope),
    false,
    2,
    0,
    14
  )
  returning id into v_source_id;

  insert into public.company_sources (company_id, source_id, active)
  values (p_company_id, v_source_id, true)
  on conflict (company_id, source_id)
  do update set active = true
  returning * into v_company_source;

  return v_company_source;
end;
$$;

revoke all on function public.add_company_rss_source(uuid, text, text, text) from public;
grant execute on function public.add_company_rss_source(uuid, text, text, text) to authenticated;

comment on function public.add_company_rss_source(uuid, text, text, text) is
  'Erstellt eine Custom-RSS-Source mit feed_scope (niche_news|top_post|both) und aktiviert sie für die eigene Company.';
