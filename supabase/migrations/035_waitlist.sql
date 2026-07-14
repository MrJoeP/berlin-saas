-- Waitlist für Testzugänge (Early Access). Öffentliches Formular auf /early-access,
-- Freigabe der Testzugänge erfolgt manuell (status pending -> invited -> active).

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  tools text[] not null default '{}',
  source text,
  status text not null default 'pending' check (status in ('pending', 'invited', 'active', 'declined')),
  created_at timestamptz not null default now()
);

alter table waitlist enable row level security;

-- Anonyme Besucher dürfen sich nur eintragen. Kein Lesen, kein Ändern.
create policy waitlist_insert_public
  on waitlist for insert
  to anon, authenticated
  with check (true);

-- Lesen nur eingeloggt (Freigabe-Verwaltung im Dashboard oder per SQL).
create policy waitlist_select_auth
  on waitlist for select
  to authenticated
  using (true);
