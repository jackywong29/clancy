-- 012 — tasks + calendar modules (Batch 6, 2026-07-10)
-- Per-workspace tasks (status/assignee/due date, optional record link) and
-- calendar events. Status is plain text validated in app — no CHECK enums
-- (the MSA gotcha). Module visibility is toggled in crm_config.modules.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  details text,
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  status text not null default 'pending',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  details text,
  starts_on date not null,
  event_time text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
alter table public.events enable row level security;

drop policy if exists "org members manage tasks" on public.tasks;
create policy "org members manage tasks" on public.tasks
  for all using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

drop policy if exists "org members manage events" on public.events;
create policy "org members manage events" on public.events
  for all using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

-- Workspace members can see each other (needed for assignee dropdowns).
drop policy if exists "org members read co-members" on public.profiles;
create policy "org members read co-members" on public.profiles
  for select using (
    organization_id is not null
    and organization_id = public.auth_org_id()
  );

-- Turn the modules on for existing workspaces.
update public.organizations
set crm_config = jsonb_set(
  coalesce(crm_config, '{}'::jsonb),
  '{modules}',
  '{"tasks": true, "calendar": true}'::jsonb,
  true
);
