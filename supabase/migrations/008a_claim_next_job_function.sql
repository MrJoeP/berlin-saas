-- Migration 008a: RPC für den Worker.
-- Claimt atomar einen pending Job mit FOR UPDATE SKIP LOCKED.
-- Berücksichtigt depends_on: alle Vorgänger müssen completed sein.

create or replace function public.claim_next_job()
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.jobs j
  set status = 'running', started_at = now()
  where j.id = (
    select id
    from public.jobs
    where status = 'pending'
      and scheduled_for <= now()
      and not exists (
        select 1
        from unnest(depends_on) as dep_id
        join public.jobs d on d.id = dep_id
        where d.status != 'completed'
      )
    order by scheduled_for
    limit 1
    for update skip locked
  )
  returning *;
end;
$$;

comment on function public.claim_next_job() is 'Atomarer Job-Claim für den Orchestrator-Worker. Berücksichtigt Dependencies und FOR UPDATE SKIP LOCKED.';

revoke all on function public.claim_next_job() from public;
grant execute on function public.claim_next_job() to service_role;
