-- Clancy — current schema (last updated with migration 021, 2026-09-28)
--
-- WHAT THIS FILE IS: the whole database in its present shape, as one
-- from-scratch build. It is the reference for "what does the database look
-- like right now", and what you would run against an EMPTY project.
--
-- WHAT THIS FILE IS NOT: something to run against the live database. The
-- numbered migrations are the record of what has actually been executed, and
-- they stay the source of truth for anything already applied. When a
-- migration changes a function or policy, mirror the new version here in the
-- same session — that is the repo rule that keeps this file honest.
--
-- Seed data lives in its migrations, not here: the Clancy workspace + sales
-- stages are seeded below because nothing works without them, but the By You
-- rehearsal site (007), SGCKL (009) and the landing page row (016) are not.
--
-- Rules (see CLAUDE.md): organization_id + RLS on every table; no
-- CHECK-constraint enums — role, status, tier, vertical, repeat and stage
-- names are plain text so they stay configurable as data.
--
-- Requires PostgreSQL 15+ (composite foreign keys use ON DELETE SET NULL
-- with a column list).

create extension if not exists "pgcrypto";

-- ===========================================================================
-- TABLES
-- ===========================================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  -- Defines what a workspace tracks: record labels, custom fields, modules,
  -- departments, calendar categories, role labels, invite template, email
  -- signature. All data — adding one never needs a migration.
  crm_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  -- Nullable since 002: a new signup lands org-less and RLS blocks
  -- everything until they are granted access (or an invite is confirmed).
  organization_id uuid references public.organizations(id),
  full_name text,
  email text,
  -- viewer < editor < admin. The default is the pre-roles legacy value;
  -- 013 mapped every existing 'owner' to 'admin' and every write path sets
  -- the role explicitly, so nothing new is created as 'owner'.
  role text not null default 'owner',
  department text,
  -- Clancy staff: admin everywhere, across every workspace. Distinct from a
  -- workspace admin, who is confined to their own workspace.
  is_platform_admin boolean not null default false,
  -- NB: organization_id is MUTABLE here — the header workspace switcher and
  -- updateProfileAccess both rewrite it. Nothing may reference
  -- (id, organization_id) as a foreign key for that reason; see
  -- tasks.assignee_id.
  created_at timestamptz not null default now()
);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  position integer not null,
  -- The SOP layer: [{ title, details?, department?, due_in_days?, blocking? }]
  -- materialised as tasks when a record enters this stage.
  checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint pipeline_stages_id_org_key unique (id, organization_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  stage_id uuid,
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
  -- Values for the workspace's own crm_config.fields.
  custom jsonb not null default '{}'::jsonb,
  -- Secret for the client-facing intake link at /i/<token>.
  intake_token uuid not null default gen_random_uuid(),
  intake_token_expires_at timestamptz default (now() + interval '30 days'),
  -- When the record entered its CURRENT stage. updated_at cannot answer
  -- this: editing a phone number resets it.
  stage_entered_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_id_org_key unique (id, organization_id),
  -- Composite: the stage must belong to the record's own workspace.
  constraint clients_stage_org_fkey foreign key (stage_id, organization_id)
    references public.pipeline_stages (id, organization_id)
);

create unique index clients_intake_token_idx on public.clients (intake_token);

create table public.intakes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  -- Answers keyed "<section>.<field>" (definition in lib/intake.ts, so
  -- changing the checklist never needs a migration). Answers typed by the
  -- CLIENT through /i/<token> live under the reserved key '_client' as a
  -- nested map of the same shape, so a client can never overwrite a staff
  -- answer; lib/intake.ts merges the two with staff winning.
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  slug text not null unique,
  published boolean not null default false,
  -- The whole public website: copy, colours, fonts, sections, socials,
  -- gallery, FAQ, signup form toggle. Rendered at /s/<slug>.
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'viewer',
  department text,
  expires_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid,
  title text not null,
  details text,
  -- Same-workspace rule enforced by tasks_assignee_guard, not a foreign key:
  -- profiles.organization_id is mutable, so a composite FK here would break
  -- the workspace switcher.
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  -- pending / in_progress / done — validated in the app, never by a CHECK.
  status text not null default 'pending',
  department text,
  -- The stage whose checklist created this task: makes generation idempotent
  -- and drives the n/m progress pill.
  origin_stage_id uuid,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Composite foreign keys: every referenced row must be in the same
  -- workspace. ON DELETE SET NULL names its column because
  -- organization_id is NOT NULL and must not be nulled alongside it.
  constraint tasks_client_org_fkey foreign key (client_id, organization_id)
    references public.clients (id, organization_id)
    on delete set null (client_id),
  constraint tasks_origin_stage_org_fkey foreign key (origin_stage_id, organization_id)
    references public.pipeline_stages (id, organization_id)
    on delete set null (origin_stage_id)
);

create index tasks_client_origin_stage_idx on public.tasks (client_id, origin_stage_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid,
  title text not null,
  details text,
  starts_on date not null,
  event_time text,
  ends_on date,
  end_time text,
  all_day boolean not null default false,
  -- none / daily / weekly / biweekly / monthly / yearly, expanded at read
  -- time in lib/recurrence.ts — no row per occurrence.
  repeat text not null default 'none',
  alert_departments jsonb not null default '[]'::jsonb,
  alert_minutes integer,
  category text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint events_client_org_fkey foreign key (client_id, organization_id)
    references public.clients (id, organization_id)
    on delete set null (client_id)
);

create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subject text not null,
  body text not null,
  -- 'all' | 'stage:<uuid>' | 'team' | 'role:<r>' | 'dept:<key>' | 'custom'
  audience text not null default 'all',
  -- Free-typed addresses, its own column so the audience label stays readable.
  custom_recipients jsonb not null default '[]'::jsonb,
  -- [{ path, name, size, type, inline }] in the private broadcast-files bucket.
  attachments jsonb not null default '[]'::jsonb,
  recipient_count integer not null default 0,
  status text not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Stage history. Readable by the workspace; written ONLY by the trigger
-- (no insert/update/delete policy exists, so clients cannot forge it).
create table public.stage_transitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  from_stage_id uuid references public.pipeline_stages(id) on delete set null,
  to_stage_id uuid references public.pipeline_stages(id) on delete set null,
  moved_by uuid references public.profiles(id) on delete set null,
  at timestamptz not null default now()
);

create index stage_transitions_org_at_idx on public.stage_transitions (organization_id, at);
create index stage_transitions_client_at_idx on public.stage_transitions (client_id, at);

-- ===========================================================================
-- AUTH HELPERS — every RLS policy bottoms out in one of these three.
-- All are SECURITY DEFINER to avoid recursing through profiles' own policies.
-- ===========================================================================

create or replace function public.auth_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_platform_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Platform admins read as 'admin' in every workspace they are switched into.
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

-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.clients enable row level security;
alter table public.intakes enable row level security;
alter table public.sites enable row level security;
alter table public.org_invites enable row level security;
alter table public.notifications enable row level security;
alter table public.tasks enable row level security;
alter table public.events enable row level security;
alter table public.broadcasts enable row level security;
alter table public.stage_transitions enable row level security;

create policy "read own org" on public.organizations
  for select using (id = public.auth_org_id());

create policy "platform admin reads all orgs" on public.organizations
  for select using (public.is_platform_admin());

-- Workspace ADMINS only: this row carries the name, the slug and the whole of
-- crm_config, including the signature block on every outbound broadcast.
create policy "org members update org" on public.organizations
  for update to authenticated
  using (id = public.auth_org_id() and public.auth_role() = 'admin')
  with check (id = public.auth_org_id() and public.auth_role() = 'admin');

create policy "platform admin updates orgs" on public.organizations
  for update using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "read own profile" on public.profiles
  for select using (id = auth.uid());

create policy "org members read co-members" on public.profiles
  for select using (
    organization_id is not null
    and organization_id = public.auth_org_id()
  );

create policy "platform admin reads all profiles" on public.profiles
  for select using (public.is_platform_admin());

-- There is deliberately NO self-update policy on profiles: a user cannot set
-- their own organization_id, role or is_platform_admin. Workspace admins
-- change a member's role through set_member_role() instead.
create policy "platform admin updates profiles" on public.profiles
  for update using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "org members read stages" on public.pipeline_stages
  for select using (organization_id = public.auth_org_id());

create policy "org members write stages" on public.pipeline_stages
  for all using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

create policy "org members manage clients" on public.clients
  for all using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

create policy "org members manage intakes" on public.intakes
  for all using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

-- Anonymous visitors read a published site; /s/<slug> depends on it.
create policy "public can read published sites" on public.sites
  for select using (published = true);

create policy "org members manage sites" on public.sites
  for all using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

create policy "platform admin manages sites" on public.sites
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "workspace admins manage invites" on public.org_invites
  for all using (
    public.is_platform_admin()
    or (organization_id = public.auth_org_id() and public.auth_role() = 'admin')
  )
  with check (
    public.is_platform_admin()
    or (organization_id = public.auth_org_id() and public.auth_role() = 'admin')
  );

create policy "org members read notifications" on public.notifications
  for select using (organization_id = public.auth_org_id());

create policy "org members update notifications" on public.notifications
  for update using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

create policy "org members manage tasks" on public.tasks
  for all using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

create policy "org members manage events" on public.events
  for all using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

create policy "org members manage broadcasts" on public.broadcasts
  for all using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

create policy "org members read stage transitions" on public.stage_transitions
  for select using (organization_id = public.auth_org_id());

-- ===========================================================================
-- STORAGE
-- ===========================================================================

-- Public: logos, hero images, galleries, favicons for the client websites.
insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

-- Private: intake uploads (logo files, photos, the customer list).
insert into storage.buckets (id, name, public)
values ('intake-files', 'intake-files', false)
on conflict (id) do nothing;

-- Private: broadcast attachments. The server downloads each file under the
-- caller's own session and hands nodemailer a buffer, so nothing ever needs
-- a public URL.
insert into storage.buckets (id, name, public)
values ('broadcast-files', 'broadcast-files', false)
on conflict (id) do nothing;

-- Every bucket policy scopes on the first path segment being the caller's
-- organization_id, and every one of them names its role.
create policy "manage site assets" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'site-assets'
    and (
      public.is_platform_admin()
      or (storage.foldername(name))[1] = public.auth_org_id()::text
    )
  )
  with check (
    bucket_id = 'site-assets'
    and (
      public.is_platform_admin()
      or (storage.foldername(name))[1] = public.auth_org_id()::text
    )
  );

create policy "org members manage intake files" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'intake-files'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
  )
  with check (
    bucket_id = 'intake-files'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
  );

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

-- ===========================================================================
-- SIGNUP, INVITES AND MEMBERSHIP
-- ===========================================================================

-- An invite is spent only by someone who has proved control of the invited
-- mailbox, and only while it is unexpired. Trigger-only: revoked from every
-- client role.
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

  if not exists (
    select 1 from public.profiles
    where id = p_user_id and organization_id is null
  ) then
    return;
  end if;

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

-- New signups: owner emails → Clancy platform admin; everyone else →
-- org-less, with no data access, until an invite is confirmed or a platform
-- admin grants access on /team. To add or remove an owner, edit the array.
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

  -- Already confirmed at creation (OAuth, or an admin-created user): there
  -- will be no confirmation UPDATE, so claim here instead.
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_confirmed();

-- The only way a member's role or department changes. A policy cannot
-- express "may change role and department but never organization_id or
-- is_platform_admin", so the whole rule lives here.
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

  if v_target.organization_id is distinct from v_org then
    raise exception 'Not allowed: that member is not in this workspace';
  end if;

  if v_target.is_platform_admin and not v_caller_platform then
    raise exception 'Not allowed: that account is Clancy staff';
  end if;

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
-- THE PUBLIC WEBSITE SIGNUP FORM
-- ===========================================================================

-- Anonymous by design: a visitor to /s/<slug> creates a record on the
-- workspace's board plus an inbox notification. The site must be published
-- AND have the form switched on, every field is capped, and a workspace
-- cannot take more than 20 of these an hour.
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
-- THE CLIENT-FACING INTAKE LINK  (/i/<token>, anonymous)
-- ===========================================================================

-- Derived from CLIENT_FACING_KEYS in lib/intake.ts (the fields carrying
-- clientFacing: true). THE TWO MUST STAY IN STEP — the app is the source of
-- truth; a field marked clientFacing but missing here renders blank.
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

-- Returns only the answers the /i page renders. Never the storage paths,
-- Google Business Profile access status, payment needs or customer list.
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

  -- An expired link and an unknown link are deliberately indistinguishable.
  if not found
     or (v_client.intake_token_expires_at is not null
         and v_client.intake_token_expires_at <= now()) then
    return null;
  end if;

  v_data := v_client.data;

  -- The client sees their own answers where they gave one, staff answers
  -- otherwise; the reserved key never leaves the function.
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

-- Client answers are namespaced under '_client', so an anonymous write can
-- never replace a staff answer whatever keys it sends.
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

  select coalesce(jsonb_object_agg(k, new_data->k), '{}'::jsonb)
    into v_incoming
    from unnest(public.client_facing_intake_keys()) as k
    where new_data ? k;

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

-- Rotating the link: the old /i/<token> stops working immediately.
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
-- STAGE INTEGRITY — the rules live here because six code paths change a
-- record's stage and the database is the one layer all six cross.
-- ===========================================================================

-- Idempotent by title: moving a record out of a stage and back creates
-- nothing new, but an item added to the stage later can still be pulled in.
-- Due dates are counted from today in Malaysia time.
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
  -- form's submit_lead() fires the trigger; anon cannot call this directly.)
  if auth.uid() is not null
     and v_client.organization_id is distinct from public.auth_org_id() then
    raise exception 'Not allowed';
  end if;

  -- The stage must belong to the record's own workspace.
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

-- BEFORE trigger on clients: the blocking rule, and the stage clock.
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
  -- FORWARD move. Backward moves are never blocked. Both stages must belong
  -- to the record's own workspace.
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

create trigger clients_stage_guard
  before insert or update of stage_id on public.clients
  for each row execute function public.clients_stage_guard();

-- AFTER trigger on clients: record the move, then create the checklist.
-- AFTER, so the row exists for the tasks' foreign key on INSERT.
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

create trigger clients_stage_after
  after insert or update of stage_id on public.clients
  for each row execute function public.clients_stage_after();

-- Stamp completed_at when a task is ticked done, clear it on reopen.
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

create trigger tasks_completed_at
  before insert or update of status on public.tasks
  for each row execute function public.tasks_completed_at();

-- ===========================================================================
-- SEED — Clancy is organization #1, with its own sales pipeline as the stages
-- ===========================================================================

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
