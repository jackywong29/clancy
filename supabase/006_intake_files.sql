-- 006 — intakes table (missing in prod: 003 never ran and 005 didn't
-- recreate it) + storage bucket for intake file uploads. Idempotent.

create table if not exists public.intakes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.intakes enable row level security;

drop policy if exists "org members manage intakes" on public.intakes;
create policy "org members manage intakes" on public.intakes
  for all using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

-- Private storage bucket for intake uploads (logos, photos, customer lists).
-- Files live under <org_id>/<client_id>/<field>/<file> — the first folder
-- must match the uploader's org, enforced below.
insert into storage.buckets (id, name, public)
values ('intake-files', 'intake-files', false)
on conflict (id) do nothing;

drop policy if exists "org members manage intake files" on storage.objects;
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
