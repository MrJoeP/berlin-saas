-- Migration 038: Invite-Gating. Login bleibt offen (Google + Magic Link),
-- aber Firmen anlegen dürfen nur Eingeladene (waitlist.status invited/active)
-- oder der Admin. Zusätzlich Leak-Fix: die Waitlist war für ALLE eingeloggten
-- User lesbar, jetzt nur noch die eigene Zeile (bzw. alles für den Admin).

-- Waitlist-Leserechte einschränken.
drop policy if exists waitlist_select_auth on waitlist;
create policy waitlist_select_own
  on waitlist for select to authenticated
  using (
    lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
    or lower(coalesce(auth.jwt()->>'email', '')) in ('dariopilipovic01@gmail.com', 'dariopilipovic@web.de')
  );

-- companies_own (FOR ALL) aufsplitten: Lesen/Ändern/Löschen wie bisher nur die
-- eigenen, Anlegen nur mit Einladung.
drop policy if exists "companies_own" on public.companies;

create policy "companies_select_own"
  on public.companies for select to authenticated
  using (auth.uid() = user_id);

create policy "companies_update_own"
  on public.companies for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "companies_delete_own"
  on public.companies for delete to authenticated
  using (auth.uid() = user_id);

create policy "companies_insert_invited"
  on public.companies for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      lower(coalesce(auth.jwt()->>'email', '')) in ('dariopilipovic01@gmail.com', 'dariopilipovic@web.de')
      or exists (
        select 1 from waitlist w
        where lower(w.email) = lower(coalesce(auth.jwt()->>'email', ''))
          and w.status in ('invited', 'active')
      )
    )
  );
