-- 007 — client websites v0.1 (2026-07-07)
-- Multi-tenant public sites: one row per client site, rendered by the app
-- at /s/<slug> from config JSON. Includes the By You Enterprise rehearsal
-- seed: organization #2 + F&B pipeline + published trial site.

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  slug text not null unique,
  published boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sites enable row level security;

drop policy if exists "public can read published sites" on public.sites;
create policy "public can read published sites" on public.sites
  for select using (published = true);

drop policy if exists "org members manage sites" on public.sites;
create policy "org members manage sites" on public.sites
  for all using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

drop policy if exists "platform admin manages sites" on public.sites;
create policy "platform admin manages sites" on public.sites
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Public bucket for site assets (logos, hero images) — world-readable,
-- writable by the org's members or platform admins.
insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

drop policy if exists "manage site assets" on storage.objects;
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

-- ============ Rehearsal seed: The By You Enterprise ============

insert into public.organizations (name, slug)
values ('The By You Enterprise', 'byyou')
on conflict (slug) do nothing;

insert into public.pipeline_stages (organization_id, name, position)
select o.id, s.name, s.position
from public.organizations o,
  (values
    ('Inquiry', 1),
    ('Reservation', 2),
    ('Confirmed', 3),
    ('Completed', 4),
    ('Review requested', 5),
    ('Regular', 6)
  ) as s(name, position)
where o.slug = 'byyou'
  and not exists (
    select 1 from public.pipeline_stages ps where ps.organization_id = o.id
  );

insert into public.sites (organization_id, slug, published, config)
select
  o.id,
  'byyou',
  true,
  '{
    "name": "The By You Enterprise",
    "tagline": "Made fresh. Made for you.",
    "description": "Placeholder trial copy — this paragraph comes from the intake once real answers exist. For now: honest home-style F&B, made to order, somewhere on Jalan 123123123.",
    "phone": "123123123123123",
    "whatsapp": "123123123123123",
    "address": "jalan 123123123",
    "hours": "Daily, 10am - 10pm",
    "accent": "#B45309",
    "logo_url": null,
    "services": [
      { "name": "service", "price": "RM 150", "duration": "", "bookable": true }
    ],
    "faq": []
  }'::jsonb
from public.organizations o
where o.slug = 'byyou'
on conflict (slug) do nothing;
