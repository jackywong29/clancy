-- 022 — workspace roles enforced in the database (2026-10-09)
--
-- Security review finding #1. Until now the viewer/editor/admin roles were
-- enforced only in lib/permissions.ts, in the server actions. Every table
-- policy granted FOR ALL to any member of the workspace, and the anon key is
-- public, so a viewer holding a normal session could insert, update or delete
-- any row in their own workspace by calling PostgREST directly.
--
-- This migration splits each "manage" policy into a member READ policy plus
-- INSERT / UPDATE / DELETE policies that carry the same role the app already
-- requires on that path (lib/actions.ts):
--
--   clients, intakes, tasks, events, broadcasts   -> editor or admin
--   pipeline_stages, sites                        -> admin
--   organizations (UPDATE)                        -> admin (already, from 021)
--   org_invites                                   -> admin (already)
--   notifications (UPDATE, mark as read)          -> any member (unchanged)
--   stage_transitions                             -> read only (unchanged)
--
-- The tenant wall is unchanged: every predicate still requires
-- organization_id = auth_org_id(). Platform admins read as 'admin' wherever
-- they are switched in, and keep their own cross-workspace sites policy.
--
-- auth_role() now normalises the stored role exactly as normalizeRole() does
-- in lib/permissions.ts ('owner' -> admin, anything unknown -> viewer), so the
-- database and the app can never disagree about who is an admin.
--
-- generate_stage_tasks() is SECURITY DEFINER, so RLS does not stop a viewer
-- calling it as an RPC; it now refuses non-editors itself.
--
-- MUST run after 021 (assumes 021's admin-only organizations UPDATE policy and
-- 021's generate_stage_tasks body). Safe to run twice: every policy is
-- dropped if it exists, then recreated.
--
-- Not covered here: storage bucket uploads stay org-scoped but role-agnostic,
-- and task department scoping stays app-enforced (taskDepartmentFilter).

-- ---------------------------------------------------------------------------
-- 1. auth_role() — one normalisation, shared with the app
-- ---------------------------------------------------------------------------

create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case
       when is_platform_admin then 'admin'
       when role in ('admin', 'owner') then 'admin'
       when role = 'editor' then 'editor'
       else 'viewer'
     end
     from public.profiles where id = auth.uid()),
    'viewer'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Editor-or-admin tables: clients, intakes, tasks, events, broadcasts
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['clients', 'intakes', 'tasks', 'events', 'broadcasts']
  loop
    -- The old FOR ALL policies, by their original names.
    execute format('drop policy if exists %I on public.%I', 'org members manage ' || t, t);

    execute format('drop policy if exists %I on public.%I', 'org members read ' || t, t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (organization_id = public.auth_org_id())',
      'org members read ' || t, t);

    execute format('drop policy if exists %I on public.%I', 'editors insert ' || t, t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (organization_id = public.auth_org_id()
                     and public.auth_role() in (''editor'', ''admin''))',
      'editors insert ' || t, t);

    execute format('drop policy if exists %I on public.%I', 'editors update ' || t, t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (organization_id = public.auth_org_id()
                and public.auth_role() in (''editor'', ''admin''))
         with check (organization_id = public.auth_org_id()
                     and public.auth_role() in (''editor'', ''admin''))',
      'editors update ' || t, t);

    execute format('drop policy if exists %I on public.%I', 'editors delete ' || t, t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (organization_id = public.auth_org_id()
                and public.auth_role() in (''editor'', ''admin''))',
      'editors delete ' || t, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Admin-only writes: pipeline_stages, sites
-- ---------------------------------------------------------------------------

-- pipeline_stages already had a separate member read policy
-- ("org members read stages"); only the write side changes.
drop policy if exists "org members write stages" on public.pipeline_stages;
drop policy if exists "admins insert stages" on public.pipeline_stages;
drop policy if exists "admins update stages" on public.pipeline_stages;
drop policy if exists "admins delete stages" on public.pipeline_stages;

create policy "admins insert stages" on public.pipeline_stages
  for insert to authenticated
  with check (organization_id = public.auth_org_id() and public.auth_role() = 'admin');

create policy "admins update stages" on public.pipeline_stages
  for update to authenticated
  using (organization_id = public.auth_org_id() and public.auth_role() = 'admin')
  with check (organization_id = public.auth_org_id() and public.auth_role() = 'admin');

create policy "admins delete stages" on public.pipeline_stages
  for delete to authenticated
  using (organization_id = public.auth_org_id() and public.auth_role() = 'admin');

-- sites: anonymous read of published sites and the platform-admin policy are
-- untouched. Members still read their own (possibly unpublished) site.
drop policy if exists "org members manage sites" on public.sites;
drop policy if exists "org members read sites" on public.sites;
drop policy if exists "admins insert sites" on public.sites;
drop policy if exists "admins update sites" on public.sites;
drop policy if exists "admins delete sites" on public.sites;

create policy "org members read sites" on public.sites
  for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "admins insert sites" on public.sites
  for insert to authenticated
  with check (organization_id = public.auth_org_id() and public.auth_role() = 'admin');

create policy "admins update sites" on public.sites
  for update to authenticated
  using (organization_id = public.auth_org_id() and public.auth_role() = 'admin')
  with check (organization_id = public.auth_org_id() and public.auth_role() = 'admin');

create policy "admins delete sites" on public.sites
  for delete to authenticated
  using (organization_id = public.auth_org_id() and public.auth_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 4. generate_stage_tasks() — refuse viewers calling it as an RPC
-- ---------------------------------------------------------------------------

-- Body identical to 021 except the role check added to the signed-in branch.
-- From the trigger the caller is already an editor (only editors can write
-- clients now); from submit_lead() auth.uid() is null and the check is skipped.
create or replace function public.generate_stage_tasks(p_client_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client record;
  v_checklist jsonb;
  v_item jsonb;
  v_title text;
  v_days integer;
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_created integer := 0;
begin
  select id, organization_id, stage_id
    into v_client
    from clients
    where id = p_client_id;

  if not found or v_client.stage_id is null then
    return 0;
  end if;

  -- Reached two ways: from the trigger, and as an RPC from the "Add this
  -- stage's tasks" button. As an RPC it runs as the signed-in user, who may
  -- only touch their own workspace, and only as an editor or admin.
  -- (auth.uid() is null only when the website form's submit_lead() fires the
  -- trigger; anon cannot call this directly.)
  if auth.uid() is not null then
    if v_client.organization_id is distinct from public.auth_org_id() then
      raise exception 'Not allowed';
    end if;
    if public.auth_role() not in ('editor', 'admin') then
      raise exception 'Not allowed: editors and admins only';
    end if;
  end if;

  -- The stage must belong to the record's own workspace. Without this, a
  -- record pointed at a foreign stage would materialise that workspace's
  -- checklist titles, details and department names as tasks here.
  select checklist into v_checklist
    from pipeline_stages
    where id = v_client.stage_id
      and organization_id = v_client.organization_id;

  if v_checklist is null or jsonb_typeof(v_checklist) <> 'array' then
    return 0;
  end if;

  for v_item in select value from jsonb_array_elements(v_checklist) loop
    v_title := btrim(coalesce(v_item->>'title', ''));
    continue when v_title = '';

    continue when exists (
      select 1 from tasks
      where client_id = p_client_id
        and origin_stage_id = v_client.stage_id
        and title = v_title
    );

    v_days := case
      when jsonb_typeof(v_item->'due_in_days') = 'number'
        then greatest(0, round((v_item->>'due_in_days')::numeric))::integer
      else null
    end;

    insert into tasks (
      organization_id, client_id, origin_stage_id, title, details,
      department, due_date, status, created_by
    ) values (
      v_client.organization_id,
      p_client_id,
      v_client.stage_id,
      v_title,
      nullif(btrim(coalesce(v_item->>'details', '')), ''),
      nullif(btrim(coalesce(v_item->>'department', '')), ''),
      case when v_days is null then null else v_today + v_days end,
      'pending',
      auth.uid()
    );
    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

revoke all on function public.generate_stage_tasks(uuid) from public, anon;
grant execute on function public.generate_stage_tasks(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Report: any OTHER policy on these tables
-- ---------------------------------------------------------------------------

-- Permissive policies are OR'd together, so one leftover FOR ALL policy that
-- this file does not know about (created by hand in the dashboard, say) would
-- quietly re-open writes to every member. Expect no WARNING. If one appears,
-- drop the named policy unless you know why it exists.
do $$
declare
  r record;
begin
  for r in
    select tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and tablename in ('clients', 'intakes', 'tasks', 'events', 'broadcasts',
                        'pipeline_stages', 'sites')
      and policyname not in (
        'org members read clients', 'editors insert clients', 'editors update clients', 'editors delete clients',
        'org members read intakes', 'editors insert intakes', 'editors update intakes', 'editors delete intakes',
        'org members read tasks', 'editors insert tasks', 'editors update tasks', 'editors delete tasks',
        'org members read events', 'editors insert events', 'editors update events', 'editors delete events',
        'org members read broadcasts', 'editors insert broadcasts', 'editors update broadcasts', 'editors delete broadcasts',
        'org members read stages', 'admins insert stages', 'admins update stages', 'admins delete stages',
        'org members read sites', 'admins insert sites', 'admins update sites', 'admins delete sites',
        'public can read published sites', 'platform admin manages sites'
      )
  loop
    raise warning 'Unexpected policy "%" (%) on public.% — it may bypass the role rules in 022',
      r.policyname, r.cmd, r.tablename;
  end loop;
end;
$$;
