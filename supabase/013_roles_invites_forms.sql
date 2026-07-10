-- 013 — roles, invites, calendar categories, website signup forms (Batch 7)
-- Roles: viewer / editor / admin per workspace (labels renameable in
-- crm_config.role_labels). Departments + calendar categories live in
-- crm_config as data. Invites pre-authorize an email with a role, MSA
-- allowed_emails style. submit_lead() lets a client's public website create
-- records directly on their board + a notification.

alter table public.profiles add column if not exists department text;
alter table public.tasks add column if not exists department text;
alter table public.events add column if not exists category text;

-- Existing members created before roles existed were 'owner' — map to admin.
update public.profiles set role = 'admin' where role = 'owner';

-- Role of the signed-in user (definer: avoids RLS recursion in policies).
create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case when is_platform_admin then 'admin' else role end
     from public.profiles where id = auth.uid()),
    'viewer'
  );
$$;

-- ============ Invites (pre-authorized emails per workspace) ============

create table if not exists public.org_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'viewer',
  department text,
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

alter table public.org_invites enable row level security;

drop policy if exists "workspace admins manage invites" on public.org_invites;
create policy "workspace admins manage invites" on public.org_invites
  for all using (
    public.is_platform_admin()
    or (organization_id = public.auth_org_id() and public.auth_role() = 'admin')
  )
  with check (
    public.is_platform_admin()
    or (organization_id = public.auth_org_id() and public.auth_role() = 'admin')
  );

-- New signups: owner emails → Clancy admin; invited emails → their
-- workspace with the invited role; everyone else → org-less (no access).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  clancy_org uuid;
  is_owner boolean;
  inv record;
begin
  select id into clancy_org from public.organizations where slug = 'clancy';
  is_owner := new.email = any (array[
    'jackywong0004@gmail.com',
    'clancy.hq.ai@gmail.com'
  ]);

  select * into inv
  from public.org_invites
  where lower(email) = lower(new.email)
  limit 1;

  insert into public.profiles (id, full_name, email, organization_id, is_platform_admin, role, department)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    case
      when is_owner then clancy_org
      when inv.id is not null then inv.organization_id
      else null
    end,
    is_owner,
    case
      when is_owner then 'admin'
      when inv.id is not null then inv.role
      else 'viewer'
    end,
    case when inv.id is not null then inv.department else null end
  )
  on conflict (id) do update
    set email = excluded.email,
        organization_id = coalesce(public.profiles.organization_id, excluded.organization_id),
        is_platform_admin = public.profiles.is_platform_admin or excluded.is_platform_admin,
        role = case
          when public.profiles.organization_id is null then excluded.role
          else public.profiles.role
        end;

  if inv.id is not null then
    delete from public.org_invites where id = inv.id;
  end if;

  return new;
end;
$$;

-- ============ Notifications ============

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "org members read notifications" on public.notifications;
create policy "org members read notifications" on public.notifications
  for select using (organization_id = public.auth_org_id());

drop policy if exists "org members update notifications" on public.notifications;
create policy "org members update notifications" on public.notifications
  for update using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

-- ============ Public website signup form → board record ============

create or replace function public.submit_lead(site_slug text, lead jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
  first_stage uuid;
  lead_name text;
begin
  select organization_id into oid
  from public.sites
  where slug = site_slug and published = true;

  if oid is null then
    raise exception 'unknown site';
  end if;

  lead_name := nullif(trim(lead->>'name'), '');
  if lead_name is null then
    raise exception 'name required';
  end if;

  select id into first_stage
  from public.pipeline_stages
  where organization_id = oid
  order by position asc
  limit 1;

  insert into public.clients (organization_id, stage_id, company_name, phone, email, notes, source)
  values (
    oid,
    first_stage,
    lead_name,
    nullif(trim(lead->>'phone'), ''),
    nullif(trim(lead->>'email'), ''),
    nullif(trim(lead->>'message'), ''),
    'website form'
  );

  insert into public.notifications (organization_id, title, body, link)
  values (
    oid,
    'New signup from the website',
    lead_name || coalesce(' · ' || nullif(trim(lead->>'phone'), ''), ''),
    '/pipeline'
  );
end;
$$;

grant execute on function public.submit_lead(text, jsonb) to anon, authenticated;
