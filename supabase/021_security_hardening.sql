-- 021 — tenancy and permission invariants
--
-- Boundary work only. Nothing here changes a feature; everything here states,
-- in the database, who is allowed to do what. Each item is an invariant the
-- database now enforces itself, rather than a rule the application is trusted
-- to remember on every code path.
--
--   1. Workspace membership is granted only on a CONFIRMED email address.
--      An invite is deterministic when one address was invited twice, is
--      consumed exactly once, and expires.
--   2. The anonymous website-form endpoint honours the site's form toggle,
--      caps every field, and is rate limited per workspace.
--   3. set_member_role() is the one way to change a member's role and
--      department, and it can change ONLY those two columns.
--   4. Foreign keys agree on organization_id: a row cannot reference a row
--      belonging to another workspace.
--   5. The public intake link returns client-facing answers only, expires,
--      can be rotated, and keeps staff answers separate from client answers.
--   6. Rewriting the workspace itself (name, slug, crm_config) requires the
--      workspace ADMIN role.
--   7. The private broadcast-files bucket policy names the role it applies to.
--
-- Safe to run twice. Read the two WARNING blocks before running: sections 4
-- and 5 are the only ones that can report existing data problems, and both
-- report rather than destroy.
--
-- Requires PostgreSQL 15 or newer (section 4 uses ON DELETE SET NULL with a
-- column list). The guard immediately below fails with a readable message
-- instead of a syntax error halfway through.

do $$
begin
  if current_setting('server_version_num')::integer < 150000 then
    raise exception
      'Migration 021 needs PostgreSQL 15+ (this server is %). Section 4 uses ON DELETE SET NULL (column). Stop here.',
      current_setting('server_version');
  end if;
end;
$$;

-- ===========================================================================
-- 1. INVITES: grant on confirmation, not on signup  (review H3)
-- ===========================================================================
-- handle_new_user fired AFTER INSERT on auth.users and consumed the matching
-- org_invites row there and then — before the address had been proven. The
-- invariant now enforced: a workspace invite is only spent by someone who has
-- demonstrated control of the invited mailbox.
--
-- The profile is still created on INSERT (the app needs a profile row to
-- exist), but org-less. The grant moved to a second trigger that fires when
-- email_confirmed_at goes from null to non-null. Providers that hand us an
-- already-confirmed address (Google OAuth writes email_confirmed_at on the
-- INSERT itself) never fire that UPDATE, so the INSERT path claims the invite
-- too — but only when the address is already confirmed.
--
-- The owner-email bootstrap from 010/013 is unchanged: Jacky's two addresses
-- still land as platform admin in the Clancy workspace on INSERT, with no
-- invite involved.

alter table public.org_invites
  add column if not exists expires_at timestamptz;

alter table public.org_invites
  alter column expires_at set default (now() + interval '14 days');

-- Invites that predate this migration have no expiry. Give them a fresh 14
-- days rather than killing them retroactively; re-running changes nothing
-- because there are no NULLs left afterwards.
update public.org_invites
  set expires_at = now() + interval '14 days'
  where expires_at is null;

-- The one implementation of "spend an invite". Not reachable from the API:
-- it is called only by the two triggers below, which run as the function
-- owner. Explicitly revoked from every client role.
create or replace function public.claim_org_invite(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
begin
  if p_email is null or btrim(p_email) = '' then
    return;
  end if;

  -- An invite only ever grants access to an org-less profile. A user who
  -- already belongs to a workspace keeps the workspace and role they have.
  if not exists (
    select 1 from public.profiles
    where id = p_user_id and organization_id is null
  ) then
    return;
  end if;

  -- order by created_at: if two workspaces invited the same address, the
  -- older invite wins every time instead of whichever row Postgres returned.
  select * into inv
  from public.org_invites
  where lower(email) = lower(p_email)
    and (expires_at is null or expires_at > now())
  order by created_at
  limit 1;

  if inv.id is null then
    return;
  end if;

  update public.profiles
    set organization_id = inv.organization_id,
        role = inv.role,
        department = inv.department
    where id = p_user_id;

  delete from public.org_invites where id = inv.id;
end;
$$;

revoke all on function public.claim_org_invite(uuid, text) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  clancy_org uuid;
  is_owner boolean;
begin
  select id into clancy_org from public.organizations where slug = 'clancy';
  is_owner := new.email = any (array[
    'jackywong0004@gmail.com',
    'clancy.hq.ai@gmail.com'
  ]);

  insert into public.profiles (id, full_name, email, organization_id, is_platform_admin, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    case when is_owner then clancy_org else null end,
    is_owner,
    case when is_owner then 'admin' else 'viewer' end
  )
  on conflict (id) do update
    set email = excluded.email,
        organization_id = coalesce(public.profiles.organization_id, excluded.organization_id),
        is_platform_admin = public.profiles.is_platform_admin or excluded.is_platform_admin,
        role = case
          when public.profiles.organization_id is null then excluded.role
          else public.profiles.role
        end;

  -- Already-confirmed at creation (OAuth, or an admin-created user): there
  -- will be no confirmation UPDATE, so claim here. Email/password signups
  -- arrive unconfirmed and claim nothing yet.
  if new.email_confirmed_at is not null then
    perform public.claim_org_invite(new.id, new.email);
  end if;

  return new;
end;
$$;

create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform public.claim_org_invite(new.id, new.email);
  end if;
  return new;
end;
$$;

-- Both are trigger functions (they return `trigger`), which PostgreSQL
-- refuses to let anyone call directly, so there is no grant to state or
-- revoke beyond the ownership the triggers already run under.

-- 005 created on_auth_user_created; recreate it only if it went missing.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'on_auth_user_created'
      and not tgisinternal
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_confirmed();

-- ===========================================================================
-- 2. WEBSITE SIGNUP FORM: honour the toggle, cap the input, rate limit
--    (review M1)
-- ===========================================================================
-- submit_lead is SECURITY DEFINER and granted to anon by design — a visitor
-- has to be able to write a lead. It gated on `published = true` alone, so a
-- workspace that had deliberately switched its signup form OFF still had an
-- open write endpoint, and there was no ceiling on size or volume.
--
-- Invariants enforced here: the site must have the form switched on; every
-- stored value is bounded; a single workspace cannot receive more than 20
-- website-form records in an hour.

create or replace function public.submit_lead(site_slug text, lead jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
  cfg jsonb;
  form_on boolean;
  first_stage uuid;
  lead_name text;
  lead_phone text;
  lead_email text;
  lead_message text;
  recent integer;
begin
  select organization_id, config into oid, cfg
  from public.sites
  where slug = site_slug and published = true;

  if oid is null then
    raise exception 'unknown site';
  end if;

  -- The renderer checks this too, but an attacker does not run the renderer.
  -- Tolerant of both a JSON boolean and the string forms a config editor can
  -- leave behind, and never casts a value that would throw.
  form_on := case
    when jsonb_typeof(cfg->'form_enabled') = 'boolean'
      then (cfg->>'form_enabled')::boolean
    when lower(btrim(coalesce(cfg->>'form_enabled', ''))) in ('true', 't', '1', 'yes', 'on')
      then true
    else false
  end;

  if not coalesce(form_on, false) then
    raise exception 'signup form is not enabled for this site';
  end if;

  lead_name := nullif(left(btrim(coalesce(lead->>'name', '')), 200), '');
  if lead_name is null then
    raise exception 'name required';
  end if;

  lead_phone := nullif(left(btrim(coalesce(lead->>'phone', '')), 200), '');
  lead_email := nullif(left(btrim(coalesce(lead->>'email', '')), 200), '');
  lead_message := nullif(left(btrim(coalesce(lead->>'message', '')), 4000), '');

  -- Per-workspace hourly ceiling. Each accepted lead also fires the stage
  -- triggers (1 record + 1 notification + 1 transition + N tasks), so an
  -- unbounded endpoint is an amplification primitive, not just spam.
  select count(*) into recent
  from public.clients
  where organization_id = oid
    and source = 'website form'
    and created_at > now() - interval '1 hour';

  if recent >= 20 then
    raise exception 'too many signups for this site right now — try again later';
  end if;

  select id into first_stage
  from public.pipeline_stages
  where organization_id = oid
  order by position asc
  limit 1;

  insert into public.clients (organization_id, stage_id, company_name, phone, email, notes, source)
  values (oid, first_stage, lead_name, lead_phone, lead_email, lead_message, 'website form');

  insert into public.notifications (organization_id, title, body, link)
  values (
    oid,
    'New signup from the website',
    lead_name || coalesce(' · ' || lead_phone, ''),
    '/pipeline'
  );
end;
$$;

revoke all on function public.submit_lead(text, jsonb) from public;
grant execute on function public.submit_lead(text, jsonb) to anon, authenticated;

-- ===========================================================================
-- 3. set_member_role() — workspace admins can change a member's role  (M2)
-- ===========================================================================
-- The only surviving UPDATE policy on profiles requires is_platform_admin(),
-- so a client's own workspace admin demoting a departing employee matched
-- zero rows while the UI reported success. A policy cannot express "may
-- change role and department but never organization_id or is_platform_admin",
-- so the operation becomes a definer function with the whole rule in it.
--
-- Invariants: the caller is an admin of the workspace; the target belongs to
-- the caller's own workspace; a platform-admin account can only be touched by
-- another platform admin; the role is one of the three known keys; and only
-- `role` and `department` are ever written.

create or replace function public.set_member_role(
  p_profile_id uuid,
  p_role text,
  p_department text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_caller_platform boolean := public.is_platform_admin();
  v_role text := lower(btrim(coalesce(p_role, '')));
  v_target record;
  v_admins integer;
begin
  if v_org is null or not (v_caller_platform or public.auth_role() = 'admin') then
    raise exception 'Not allowed: only a workspace admin can change a member''s role';
  end if;

  -- Role keys are fixed by design (viewer < editor < admin); only their
  -- LABELS are renameable, in crm_config.role_labels. This is a function-level
  -- check on purpose — no CHECK-constraint enums in this schema.
  if v_role not in ('viewer', 'editor', 'admin') then
    raise exception 'Unknown role: %', p_role;
  end if;

  select id, organization_id, is_platform_admin, role
    into v_target
    from public.profiles
    where id = p_profile_id;

  if not found then
    raise exception 'Member not found';
  end if;

  -- The member must belong to the caller's own workspace. Platform admins
  -- switch workspace to act inside one, so this holds for them too.
  if v_target.organization_id is distinct from v_org then
    raise exception 'Not allowed: that member is not in this workspace';
  end if;

  if v_target.is_platform_admin and not v_caller_platform then
    raise exception 'Not allowed: that account is Clancy staff';
  end if;

  -- A workspace with no admin left can never manage its own members again.
  -- Platform admins are exempt: they can always repair it afterwards.
  if v_target.role = 'admin' and v_role <> 'admin' and not v_caller_platform then
    select count(*) into v_admins
      from public.profiles
      where organization_id = v_org
        and role = 'admin';

    if v_admins <= 1 then
      raise exception 'Not allowed: this is the last admin in the workspace';
    end if;
  end if;

  update public.profiles
    set role = v_role,
        department = nullif(btrim(coalesce(p_department, '')), '')
    where id = p_profile_id;
end;
$$;

revoke all on function public.set_member_role(uuid, text, text) from public, anon;
grant execute on function public.set_member_role(uuid, text, text) to authenticated;

-- ===========================================================================
-- 4. FOREIGN KEYS MUST AGREE ON organization_id  (review M3)
-- ===========================================================================
-- RLS validates the organization_id COLUMN of the row being written, never
-- the rows it points at. clients.stage_id, tasks.client_id,
-- tasks.origin_stage_id, tasks.assignee_id and events.client_id were plain
-- single-column FKs, so a row in one workspace could legally reference a row
-- in another — and generate_stage_tasks (SECURITY DEFINER) would then read
-- the other workspace's checklist.
--
-- The fix is structural: a unique key on (id, organization_id) on each parent,
-- then composite FKs. Once these exist the whole class is closed at zero
-- runtime cost, and the definer functions below are belt and braces.
--
-- tasks.assignee_id is the ONE exception, and deliberately so. A composite
-- FK there would reference (profiles.id, profiles.organization_id), and that
-- pair is not stable: the header workspace switcher and updateProfileAccess
-- both UPDATE profiles.organization_id (lib/actions.ts:342, :416). With a
-- composite FK, switching workspace would either fail outright for anyone
-- holding an assigned task, or silently unassign their work. The same
-- invariant is therefore enforced by a BEFORE trigger on tasks, which fires
-- on task writes only and never couples a profile update to it.
--
-- >>> WARNING — READ BEFORE RUNNING <<<
-- The report immediately below counts rows that already break these rules.
-- Expect zeroes. If any count is non-zero the constraints will STILL be added
-- (they are created NOT VALID, which enforces the rule on new and updated
-- rows and ignores history), but you must fix the listed rows and then run
-- the commented-out VALIDATE statements at the end of this section. The
-- assignee count is reported for the same reason, but is guarded by the
-- trigger rather than a constraint, and existing rows are left alone.

do $$
declare
  n_client_stage integer;
  n_task_client integer;
  n_task_stage integer;
  n_task_assignee integer;
  n_event_client integer;
begin
  select count(*) into n_client_stage
    from public.clients c
    where c.stage_id is not null
      and not exists (
        select 1 from public.pipeline_stages s
        where s.id = c.stage_id and s.organization_id = c.organization_id);

  select count(*) into n_task_client
    from public.tasks t
    where t.client_id is not null
      and not exists (
        select 1 from public.clients c
        where c.id = t.client_id and c.organization_id = t.organization_id);

  select count(*) into n_task_stage
    from public.tasks t
    where t.origin_stage_id is not null
      and not exists (
        select 1 from public.pipeline_stages s
        where s.id = t.origin_stage_id and s.organization_id = t.organization_id);

  select count(*) into n_task_assignee
    from public.tasks t
    where t.assignee_id is not null
      and not exists (
        select 1 from public.profiles p
        where p.id = t.assignee_id and p.organization_id = t.organization_id);

  select count(*) into n_event_client
    from public.events e
    where e.client_id is not null
      and not exists (
        select 1 from public.clients c
        where c.id = e.client_id and c.organization_id = e.organization_id);

  raise notice '--- cross-workspace reference report ---';
  raise notice 'clients.stage_id          mismatched: %', n_client_stage;
  raise notice 'tasks.client_id           mismatched: %', n_task_client;
  raise notice 'tasks.origin_stage_id     mismatched: %', n_task_stage;
  raise notice 'tasks.assignee_id         mismatched: % (trigger-guarded, not a constraint)', n_task_assignee;
  raise notice 'events.client_id          mismatched: %', n_event_client;

  if n_client_stage + n_task_client + n_task_stage + n_task_assignee + n_event_client > 0 then
    raise notice 'NON-ZERO above: the new constraints are NOT VALID, so they guard new writes only. Fix those rows, then run the VALIDATE statements at the end of section 4.';
  else
    raise notice 'All zero — safe to run the VALIDATE statements at the end of section 4.';
  end if;
end;
$$;

-- Parents: (id, organization_id) has to be unique for a composite FK to
-- reference it. id is already the primary key, so these can never fail on
-- duplicates — they only build an index. profiles is not in this list: see
-- the note on tasks.assignee_id above.
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'pipeline_stages_id_org_key'
                   and conrelid = 'public.pipeline_stages'::regclass) then
    alter table public.pipeline_stages
      add constraint pipeline_stages_id_org_key unique (id, organization_id);
  end if;
  if not exists (select 1 from pg_constraint
                 where conname = 'clients_id_org_key'
                   and conrelid = 'public.clients'::regclass) then
    alter table public.clients
      add constraint clients_id_org_key unique (id, organization_id);
  end if;
end;
$$;

-- Replace each single-column FK with its composite form. The drop matches on
-- the referencing column rather than a constraint name, so it finds the
-- original whatever it was called, and leaves the composite one alone on a
-- second run (its key has two columns, not one).
do $$
declare
  r record;
  v_att smallint;
begin
  -- clients.stage_id -> pipeline_stages (no ON DELETE action, as before:
  -- deleting a stage still in use is refused, and the app guards it too)
  select attnum into v_att from pg_attribute
    where attrelid = 'public.clients'::regclass and attname = 'stage_id';
  for r in select conname from pg_constraint
    where conrelid = 'public.clients'::regclass and contype = 'f'
      and conkey = array[v_att]::smallint[]
  loop
    execute format('alter table public.clients drop constraint %I', r.conname);
  end loop;

  if not exists (select 1 from pg_constraint
                 where conname = 'clients_stage_org_fkey'
                   and conrelid = 'public.clients'::regclass) then
    alter table public.clients
      add constraint clients_stage_org_fkey
      foreign key (stage_id, organization_id)
      references public.pipeline_stages (id, organization_id)
      not valid;
  end if;

  -- tasks.client_id -> clients. ON DELETE SET NULL names the column, because
  -- tasks.organization_id is NOT NULL and must not be nulled with it.
  select attnum into v_att from pg_attribute
    where attrelid = 'public.tasks'::regclass and attname = 'client_id';
  for r in select conname from pg_constraint
    where conrelid = 'public.tasks'::regclass and contype = 'f'
      and conkey = array[v_att]::smallint[]
  loop
    execute format('alter table public.tasks drop constraint %I', r.conname);
  end loop;

  if not exists (select 1 from pg_constraint
                 where conname = 'tasks_client_org_fkey'
                   and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks
      add constraint tasks_client_org_fkey
      foreign key (client_id, organization_id)
      references public.clients (id, organization_id)
      on delete set null (client_id)
      not valid;
  end if;

  -- tasks.origin_stage_id -> pipeline_stages
  select attnum into v_att from pg_attribute
    where attrelid = 'public.tasks'::regclass and attname = 'origin_stage_id';
  for r in select conname from pg_constraint
    where conrelid = 'public.tasks'::regclass and contype = 'f'
      and conkey = array[v_att]::smallint[]
  loop
    execute format('alter table public.tasks drop constraint %I', r.conname);
  end loop;

  if not exists (select 1 from pg_constraint
                 where conname = 'tasks_origin_stage_org_fkey'
                   and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks
      add constraint tasks_origin_stage_org_fkey
      foreign key (origin_stage_id, organization_id)
      references public.pipeline_stages (id, organization_id)
      on delete set null (origin_stage_id)
      not valid;
  end if;

  -- events.client_id -> clients
  select attnum into v_att from pg_attribute
    where attrelid = 'public.events'::regclass and attname = 'client_id';
  for r in select conname from pg_constraint
    where conrelid = 'public.events'::regclass and contype = 'f'
      and conkey = array[v_att]::smallint[]
  loop
    execute format('alter table public.events drop constraint %I', r.conname);
  end loop;

  if not exists (select 1 from pg_constraint
                 where conname = 'events_client_org_fkey'
                   and conrelid = 'public.events'::regclass) then
    alter table public.events
      add constraint events_client_org_fkey
      foreign key (client_id, organization_id)
      references public.clients (id, organization_id)
      on delete set null (client_id)
      not valid;
  end if;
end;
$$;

-- Run these ONLY after the report above came back all zeroes (or after you
-- fixed the rows it named). Each scans one table and takes a brief lock; they
-- are separated so one failure does not hide the others.
--   alter table public.clients validate constraint clients_stage_org_fkey;
--   alter table public.tasks   validate constraint tasks_client_org_fkey;
--   alter table public.tasks   validate constraint tasks_origin_stage_org_fkey;
--   (tasks.assignee_id is guarded by tasks_assignee_guard, not a constraint)
--   alter table public.events  validate constraint events_client_org_fkey;

-- The assignee half of the same invariant: a task can only be assigned to a
-- member of its own workspace. A trigger rather than a foreign key, because
-- profiles.organization_id is mutable (the workspace switcher) and a
-- constraint would make changing it fail or silently unassign work. This
-- fires on task writes only, so existing rows and profile updates are
-- untouched.
create or replace function public.tasks_assignee_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignee_org uuid;
begin
  if new.assignee_id is null then
    return new;
  end if;

  -- Only re-check when the pair being constrained actually changed, so
  -- ticking a task done never pays for a profile lookup.
  if tg_op = 'UPDATE'
     and new.assignee_id is not distinct from old.assignee_id
     and new.organization_id is not distinct from old.organization_id then
    return new;
  end if;

  select organization_id into v_assignee_org
    from public.profiles
    where id = new.assignee_id;

  if v_assignee_org is distinct from new.organization_id then
    raise exception 'Assignee must be a member of this workspace';
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_assignee_guard on public.tasks;
create trigger tasks_assignee_guard
  before insert or update of assignee_id, organization_id on public.tasks
  for each row execute function public.tasks_assignee_guard();

-- Belt and braces: both definer functions that read a stage now require the
-- stage to belong to the record's own workspace, so neither depends on the
-- constraints above having been validated. Bodies are otherwise identical to
-- migration 020.
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
  -- only touch their own workspace. (auth.uid() is null only when the website
  -- form's submit_lead() fires the trigger; anon cannot call this directly —
  -- see the revoke below.)
  if auth.uid() is not null
     and v_client.organization_id is distinct from public.auth_org_id() then
    raise exception 'Not allowed';
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

create or replace function public.clients_stage_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_pos integer;
  v_new_pos integer;
  v_outstanding text;
begin
  if tg_op = 'INSERT' then
    new.stage_entered_at := now();
    return new;
  end if;

  -- The edit forms always send stage_id, so this fires on every save. Only
  -- act when the stage actually changed — otherwise editing a phone number
  -- would reset how long the record has been waiting.
  if new.stage_id is not distinct from old.stage_id then
    return new;
  end if;

  -- Unfinished "must finish first" items on the stage being LEFT stop a
  -- FORWARD move. Backward moves are never blocked: sending a job back to an
  -- earlier stage has to stay possible with work outstanding.
  -- Both stages must belong to the record's own workspace: an ordering read
  -- from a foreign stage would decide this workspace's blocking rule.
  if old.stage_id is not null and new.stage_id is not null then
    select position into v_old_pos from pipeline_stages
      where id = old.stage_id and organization_id = new.organization_id;
    select position into v_new_pos from pipeline_stages
      where id = new.stage_id and organization_id = new.organization_id;

    if v_old_pos is not null and v_new_pos is not null and v_new_pos > v_old_pos then
      select string_agg(t.title, ', ' order by t.created_at)
        into v_outstanding
        from tasks t
        join pipeline_stages s on s.id = old.stage_id
        where t.client_id = old.id
          and t.origin_stage_id = old.stage_id
          and t.status <> 'done'
          and exists (
            select 1
            from jsonb_array_elements(coalesce(s.checklist, '[]'::jsonb)) i
            where btrim(coalesce(i->>'title', '')) = t.title
              and i->'blocking' = 'true'::jsonb
          );

      if v_outstanding is not null then
        raise exception 'Finish first: %', v_outstanding;
      end if;
    end if;
  end if;

  new.stage_entered_at := now();
  return new;
end;
$$;

-- Trigger function: PostgreSQL refuses a direct call of a function returning
-- `trigger`, so there is no grant to state. The trigger from 020 is unchanged
-- and keeps pointing at this body.

-- 020 left this one without a pinned search_path. It is SECURITY INVOKER, so
-- nothing escalates, but every function in this schema should resolve its
-- names the same way. Body is otherwise identical to 020; its trigger is
-- unchanged and keeps pointing at this body.
create or replace function public.tasks_completed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'done' and new.completed_at is null then
      new.completed_at := now();
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    new.completed_at := case when new.status = 'done' then now() else null end;
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- 5. THE PUBLIC INTAKE LINK  (review M7 + L5)
-- ===========================================================================
-- /i/<token> is an unauthenticated bearer capability. Three problems:
--   * intake_by_token returned the WHOLE intakes.data blob, including storage
--     paths for the logo/photos/materials, Google Business Profile access
--     status, payment needs and the uploaded customer list — none of which
--     the page renders.
--   * the token never expired and could not be rotated.
--   * save_intake_by_token merged with `||`, a shallow top-level merge, so a
--     client's answer silently replaced Jacky's answer at the same key.
--
-- Invariants now: the link returns only client-facing answers; an expired or
-- rotated token returns nothing and writes nothing; client input lands in its
-- own namespace and can never overwrite a staff answer.

alter table public.clients
  add column if not exists intake_token_expires_at timestamptz;

alter table public.clients
  alter column intake_token_expires_at set default (now() + interval '30 days');

-- Existing links have no expiry. Give them 30 days rather than breaking a
-- link a client may be filling in right now; "Regenerate link" on the intake
-- tab mints a fresh one. NULL is treated as "never expires" everywhere below,
-- so this UPDATE is the only thing standing between old links and forever.
update public.clients
  set intake_token_expires_at = now() + interval '30 days'
  where intake_token_expires_at is null;

-- The client-facing answer keys, derived from CLIENT_FACING_KEYS in
-- lib/intake.ts (the fields carrying `clientFacing: true` in INTAKE_SECTIONS).
-- THESE TWO LISTS MUST STAY IN STEP: a field marked clientFacing in the app
-- but missing here renders blank on /i/<token>; one listed here but not in
-- the app is simply never returned. The app is the source of truth.
create or replace function public.client_facing_intake_keys()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[
    'basics.registered_name',
    'basics.ssm_number',
    'basics.point_of_contact',
    'basics.description',
    'basics.background',
    'contact.address',
    'contact.phone',
    'contact.email',
    'contact.hours',
    'contact.socials',
    'services.items',
    'services.promos',
    'workflow.lead_channels',
    'workflow.pipeline_steps',
    'workflow.lost_leads',
    'workflow.staff',
    'workflow.followups',
    'booking.slots',
    'booking.window',
    'booking.cancellation',
    'booking.deposit',
    'faq.questions',
    'faq.recipient',
    'faq.languages',
    'faq.tone'
  ];
$$;

revoke all on function public.client_facing_intake_keys() from public, anon;
grant execute on function public.client_facing_intake_keys() to authenticated;

-- Client answers live under this one reserved key, as a flat map of the same
-- "<section>.<field>" -> value shape as the staff layer. No section key can
-- collide with it: every real key contains a '.'.
create or replace function public.intake_by_token(t uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_client record;
  v_data jsonb;
  v_merged jsonb;
  v_out jsonb;
begin
  select c.id, c.company_name, c.intake_token_expires_at, coalesce(i.data, '{}'::jsonb) as data
    into v_client
    from public.clients c
    left join public.intakes i on i.client_id = c.id
    where c.intake_token = t;

  -- An expired link and an unknown link are deliberately indistinguishable:
  -- the page 404s either way and neither confirms a token ever existed.
  if not found
     or (v_client.intake_token_expires_at is not null
         and v_client.intake_token_expires_at <= now()) then
    return null;
  end if;

  v_data := v_client.data;

  -- The client sees their own answers where they have given one, so the form
  -- does not look like it threw their input away. Staff answers are the
  -- fallback, and the reserved key itself never leaves the function.
  v_merged := (v_data - '_client')
    || case when jsonb_typeof(v_data->'_client') = 'object'
            then v_data->'_client' else '{}'::jsonb end;

  select coalesce(jsonb_object_agg(k, v_merged->k), '{}'::jsonb)
    into v_out
    from unnest(public.client_facing_intake_keys()) as k
    where v_merged ? k;

  return jsonb_build_object(
    'client_id', v_client.id,
    'company_name', v_client.company_name,
    'data', v_out
  );
end;
$$;

revoke all on function public.intake_by_token(uuid) from public;
grant execute on function public.intake_by_token(uuid) to anon, authenticated;

create or replace function public.save_intake_by_token(t uuid, new_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  oid uuid;
  expires timestamptz;
  v_incoming jsonb;
begin
  if new_data is null or jsonb_typeof(new_data) <> 'object' then
    raise exception 'invalid payload';
  end if;

  -- An anonymous writer must not be able to grow one row without limit.
  if pg_column_size(new_data) > 100000 then
    raise exception 'submission too large';
  end if;

  select id, organization_id, intake_token_expires_at
    into cid, oid, expires
    from public.clients
    where intake_token = t;

  if cid is null then
    raise exception 'invalid token';
  end if;

  if expires is not null and expires <= now() then
    raise exception 'intake link expired';
  end if;

  -- Only client-facing keys are accepted. submitClientIntake filters too;
  -- this is the copy that an attacker cannot skip.
  select coalesce(jsonb_object_agg(k, new_data->k), '{}'::jsonb)
    into v_incoming
    from unnest(public.client_facing_intake_keys()) as k
    where new_data ? k;

  -- Namespaced under '_client': staff answers at the top level are never
  -- touched by an anonymous write, whatever keys arrive.
  insert into public.intakes (organization_id, client_id, data)
  values (oid, cid, jsonb_build_object('_client', v_incoming))
  on conflict (client_id) do update
    set data = jsonb_set(
          coalesce(public.intakes.data, '{}'::jsonb),
          '{_client}',
          case when jsonb_typeof(public.intakes.data->'_client') = 'object'
               then public.intakes.data->'_client' else '{}'::jsonb end
            || v_incoming,
          true
        ),
        updated_at = now();
end;
$$;

revoke all on function public.save_intake_by_token(uuid, jsonb) from public;
grant execute on function public.save_intake_by_token(uuid, jsonb) to anon, authenticated;

-- Rotating the link: the old /i/<token> stops working immediately and a new
-- 30-day link is issued. Editors and admins of the record's own workspace
-- only — a viewer cannot invalidate a client's live link.
create or replace function public.regenerate_intake_token(p_client_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_client_org uuid;
  v_token uuid;
begin
  if v_org is null then
    raise exception 'Not allowed';
  end if;

  if public.auth_role() not in ('admin', 'editor') then
    raise exception 'Not allowed: editors and admins only';
  end if;

  select organization_id into v_client_org
    from public.clients
    where id = p_client_id;

  if v_client_org is null then
    raise exception 'Record not found';
  end if;

  if v_client_org is distinct from v_org then
    raise exception 'Not allowed: that record is not in this workspace';
  end if;

  v_token := gen_random_uuid();

  update public.clients
    set intake_token = v_token,
        intake_token_expires_at = now() + interval '30 days'
    where id = p_client_id;

  return v_token;
end;
$$;

revoke all on function public.regenerate_intake_token(uuid) from public, anon;
grant execute on function public.regenerate_intake_token(uuid) to authenticated;

-- ===========================================================================
-- 6. ONLY ADMINS REWRITE THE WORKSPACE  (review L1)
-- ===========================================================================
-- 011's UPDATE policy on organizations checked membership but not role, so a
-- viewer could rewrite name, slug and the whole of crm_config — departments,
-- modules, role labels, and the signature block embedded in every outbound
-- broadcast. Mirrors the org_invites policy in 013.

drop policy if exists "org members update org" on public.organizations;
create policy "org members update org" on public.organizations
  for update to authenticated
  using (id = public.auth_org_id() and public.auth_role() = 'admin')
  with check (id = public.auth_org_id() and public.auth_role() = 'admin');

-- ===========================================================================
-- 7. broadcast-files POLICY NAMES ITS ROLE  (review L6)
-- ===========================================================================
-- The 017 policy omitted `to authenticated`, so it applied to PUBLIC. Nothing
-- was reachable through it (auth_org_id() is NULL for anon and the comparison
-- yields NULL), but a private bucket should not depend on three-valued logic.
-- Identical to its intake-files and site-assets siblings otherwise.

drop policy if exists "org members manage broadcast files" on storage.objects;
create policy "org members manage broadcast files" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'broadcast-files'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
  )
  with check (
    bucket_id = 'broadcast-files'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
  );
