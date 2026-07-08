-- 008 — client-facing intake links (batch 4, 2026-07-08)
-- Each client gets a secret token; /i/<token> is a public page where the
-- client fills the client-friendly intake sections themselves. Anon access
-- goes only through the two security-definer functions below — the tables
-- stay closed. Client answers MERGE into intake data (Jacky's other
-- answers survive).

alter table public.clients
  add column if not exists intake_token uuid not null default gen_random_uuid();

create unique index if not exists clients_intake_token_idx
  on public.clients (intake_token);

create or replace function public.intake_by_token(t uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'client_id', c.id,
    'company_name', c.company_name,
    'data', coalesce(i.data, '{}'::jsonb)
  )
  from public.clients c
  left join public.intakes i on i.client_id = c.id
  where c.intake_token = t;
$$;

create or replace function public.save_intake_by_token(t uuid, new_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  oid uuid;
begin
  select id, organization_id into cid, oid
  from public.clients
  where intake_token = t;

  if cid is null then
    raise exception 'invalid token';
  end if;

  insert into public.intakes (organization_id, client_id, data)
  values (oid, cid, new_data)
  on conflict (client_id) do update
    set data = public.intakes.data || excluded.data,
        updated_at = now();
end;
$$;

grant execute on function public.intake_by_token(uuid) to anon, authenticated;
grant execute on function public.save_intake_by_token(uuid, jsonb) to anon, authenticated;
