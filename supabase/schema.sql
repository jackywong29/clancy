-- Clancy — Batch 1 schema (2026-07-07)
-- Multi-tenant core: organizations, profiles, pipeline_stages, clients.
-- Rules (see CLAUDE.md): organization_id + RLS on every table; no CHECK-constraint enums —
-- role/tier/vertical are plain text so they stay configurable as data.

create extension if not exists "pgcrypto";

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  full_name text,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  position integer not null,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  stage_id uuid references public.pipeline_stages(id),
  company_name text not null,
  contact_person text,
  phone text,
  email text,
  vertical text,
  source text,
  tier text,
  mrr numeric(10,2),
  lock_in_start date,
  renewal_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper: the signed-in user's organization (used by every RLS policy)
create or replace function public.auth_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.clients enable row level security;

create policy "read own org" on public.organizations
  for select using (id = public.auth_org_id());

create policy "read own profile" on public.profiles
  for select using (id = auth.uid());

create policy "org members read stages" on public.pipeline_stages
  for select using (organization_id = public.auth_org_id());

create policy "org members write stages" on public.pipeline_stages
  for all using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

create policy "org members manage clients" on public.clients
  for all using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

-- Seed: Clancy is organization #1, with its own sales pipeline as the stages
insert into public.organizations (name, slug) values ('Clancy', 'clancy');

insert into public.pipeline_stages (organization_id, name, position)
select o.id, s.name, s.position
from public.organizations o,
  (values
    ('Lead', 1),
    ('Pitched', 2),
    ('Intake', 3),
    ('Trial live', 4),
    ('Signed', 5),
    ('Onboarding', 6),
    ('Active', 7),
    ('Renewal due', 8)
  ) as s(name, position)
where o.slug = 'clancy';

-- New auth users get a profile attached to Clancy automatically.
-- NOTE: single-org convenience for now — must be replaced with proper org
-- assignment/invites before any client-org users exist.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, organization_id, full_name)
  values (
    new.id,
    (select id from public.organizations where slug = 'clancy'),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
