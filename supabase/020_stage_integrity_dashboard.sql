-- 020 — stage integrity + the data the Overview dashboard needs
--
-- WHY THIS MOVES LOGIC INTO THE DATABASE
-- Six code paths change a record's stage: the board dropdown, the edit forms
-- (both workspaces), new records (both workspaces), and the website signup
-- form's submit_lead() SQL function. Batch 14 hooked checklist generation and
-- the "must finish first" rule into only two of them, so the rule could be
-- bypassed by changing the Stage field in the edit form, and website leads
-- never got a stage-one checklist. That was the third bug in this area caused
-- by app-level hooks missed on a path. The database is the one layer every
-- path crosses, so the rules now live here and cannot be skipped.
--
-- WHAT THIS ADDS
--   clients.stage_entered_at   when the record entered its CURRENT stage.
--                              updated_at can't answer this: editing a phone
--                              number resets it.
--   tasks.completed_at         when a task was ticked done (cleared if reopened)
--   stage_transitions          one row per stage move, from today onward
--   generate_stage_tasks()     the single implementation of checklist
--                              generation; the trigger and the "Add this
--                              stage's tasks" button both call it
--   triggers                   on clients (stage) and tasks (status)
--
-- Safe to run twice. Run BEFORE the Batch 18 code deploys: the new Overview
-- page reads these columns and errors without them.

-- ---------------------------------------------------------------------------
-- 0. Defensive: migration 019's columns. PROGRESS lists 019 as unverified;
--    everything below builds on them, so make sure they exist.
-- ---------------------------------------------------------------------------
alter table public.pipeline_stages
  add column if not exists checklist jsonb not null default '[]'::jsonb;

alter table public.tasks
  add column if not exists origin_stage_id uuid
    references public.pipeline_stages(id) on delete set null;

create index if not exists tasks_client_origin_stage_idx
  on public.tasks (client_id, origin_stage_id);

-- ---------------------------------------------------------------------------
-- 1. When did a record enter its current stage?
--    Existing rows are backfilled from updated_at — approximate, because any
--    edit bumped it. Exact for every move from today.
-- ---------------------------------------------------------------------------
alter table public.clients
  add column if not exists stage_entered_at timestamptz;

update public.clients
  set stage_entered_at = coalesce(updated_at, created_at)
  where stage_entered_at is null;

alter table public.clients
  alter column stage_entered_at set default now();

-- ---------------------------------------------------------------------------
-- 2. When was a task finished?
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column if not exists completed_at timestamptz;

update public.tasks
  set completed_at = updated_at
  where status = 'done' and completed_at is null;

-- ---------------------------------------------------------------------------
-- 3. Stage history. Readable by the workspace; written ONLY by the trigger
--    (no insert/update/delete policy exists, so clients cannot forge it).
-- ---------------------------------------------------------------------------
create table if not exists public.stage_transitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  from_stage_id uuid references public.pipeline_stages(id) on delete set null,
  to_stage_id uuid references public.pipeline_stages(id) on delete set null,
  moved_by uuid references public.profiles(id) on delete set null,
  at timestamptz not null default now()
);

create index if not exists stage_transitions_org_at_idx
  on public.stage_transitions (organization_id, at);
create index if not exists stage_transitions_client_at_idx
  on public.stage_transitions (client_id, at);

alter table public.stage_transitions enable row level security;

drop policy if exists "org members read stage transitions" on public.stage_transitions;
create policy "org members read stage transitions" on public.stage_transitions
  for select using (organization_id = public.auth_org_id());

-- ---------------------------------------------------------------------------
-- 4. Checklist generation — the one implementation.
--    Idempotent by title: moving a record out of a stage and back creates
--    nothing new, but an item added to the stage later can still be pulled in.
--    Due dates are counted from today in Malaysia time.
-- ---------------------------------------------------------------------------
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

  select checklist into v_checklist
    from pipeline_stages
    where id = v_client.stage_id;

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

-- Signed-in users may call it (the button); anonymous visitors may not.
revoke all on function public.generate_stage_tasks(uuid) from public, anon;
grant execute on function public.generate_stage_tasks(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. BEFORE trigger on clients: the blocking rule, and the stage clock.
-- ---------------------------------------------------------------------------
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
  if old.stage_id is not null and new.stage_id is not null then
    select position into v_old_pos from pipeline_stages where id = old.stage_id;
    select position into v_new_pos from pipeline_stages where id = new.stage_id;

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

drop trigger if exists clients_stage_guard on public.clients;
create trigger clients_stage_guard
  before insert or update of stage_id on public.clients
  for each row execute function public.clients_stage_guard();

-- ---------------------------------------------------------------------------
-- 6. AFTER trigger on clients: record the move, then create the checklist.
--    AFTER, so the row exists for the tasks' foreign key on INSERT.
-- ---------------------------------------------------------------------------
create or replace function public.clients_stage_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.stage_id is not distinct from old.stage_id then
    return null;
  end if;

  insert into stage_transitions (organization_id, client_id, from_stage_id, to_stage_id, moved_by)
  values (
    new.organization_id,
    new.id,
    case when tg_op = 'UPDATE' then old.stage_id else null end,
    new.stage_id,
    auth.uid()
  );

  if new.stage_id is not null then
    perform public.generate_stage_tasks(new.id);
  end if;

  return null;
end;
$$;

drop trigger if exists clients_stage_after on public.clients;
create trigger clients_stage_after
  after insert or update of stage_id on public.clients
  for each row execute function public.clients_stage_after();

-- ---------------------------------------------------------------------------
-- 7. Trigger on tasks: stamp completed_at when ticked done, clear on reopen.
-- ---------------------------------------------------------------------------
create or replace function public.tasks_completed_at()
returns trigger
language plpgsql
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

drop trigger if exists tasks_completed_at on public.tasks;
create trigger tasks_completed_at
  before insert or update of status on public.tasks
  for each row execute function public.tasks_completed_at();
