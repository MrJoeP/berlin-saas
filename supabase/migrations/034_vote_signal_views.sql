-- Migration 034: Vote-Signal-Views für den Relevanz-Algorithmus.
-- Verbindet Item-/Cluster-Votes mit Quelle, Titel und Digest-Typ, damit
-- Worker (Source-Weighting, Topic-Learning) und Frontend (Präferenz-Panel)
-- dieselbe Datenbasis lesen. Decay/Gewichtung passiert im Code, nicht in SQL —
-- so bleibt die Formel testbar.
--
-- security_invoker = true: Views respektieren RLS. Frontend-User sehen nur
-- eigene Votes/Digests, der Worker (service_role) sieht alles.

create or replace view public.vote_item_signals
with (security_invoker = true) as
select
  d.company_id,
  d.type as digest_type,
  di.source_name,
  di.title,
  v.value,
  v.created_at
from public.votes v
join public.digest_items di on v.target_type = 'item' and v.target_id = di.id::text
join public.digests d on d.id = di.digest_id;

comment on view public.vote_item_signals is
  'Item-Votes mit Quelle+Titel+Digest-Typ. Basis für Source-Weighting und Topic-Learning.';

create or replace view public.vote_cluster_signals
with (security_invoker = true) as
select
  d.company_id,
  d.type as digest_type,
  split_part(v.target_id, '|', 2) as cluster_name,
  v.value,
  v.created_at
from public.votes v
join public.digests d
  on v.target_type = 'cluster'
 and split_part(v.target_id, '|', 1) = d.id::text;

comment on view public.vote_cluster_signals is
  'Cluster-Votes mit Namen+Digest-Typ, company-scoped. Basis für Themen-Priorisierung.';
