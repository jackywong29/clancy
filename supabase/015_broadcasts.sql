-- 015 — broadcasts (email announcements/newsletters to records)
-- v1 delivery is via the user's own mail app (mailto batches) — honest and
-- infra-free. When the email API (Resend, phase 2) lands, the same table
-- drives real sending. Audience: 'all' or 'stage:<uuid>'.

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subject text not null,
  body text not null,
  audience text not null default 'all',
  recipient_count integer not null default 0,
  status text not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.broadcasts enable row level security;

drop policy if exists "org members manage broadcasts" on public.broadcasts;
create policy "org members manage broadcasts" on public.broadcasts
  for all using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());
