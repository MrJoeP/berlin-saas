-- Migration 024: Erlaubt authenticated Users orphaned companies (user_id NULL) zu claimen.
-- Sicherheits-Bedingung: neuer user_id muss auth.uid() sein.
-- Praktisch für Personal-Tool-Migration der bestehenden Testdaten beim ersten Login.
-- Bei echtem Multi-Tenant müsste das eine SECURITY DEFINER Function werden.
drop policy if exists "claim_orphan_company" on public.companies;
create policy "claim_orphan_company"
  on public.companies for update to authenticated
  using (user_id is null)
  with check (auth.uid() = user_id);
