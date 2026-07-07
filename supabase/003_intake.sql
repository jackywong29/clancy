-- 003 — intake records (Batch 2, 2026-07-07)
-- One intake per client; answers stored as JSON keyed "<section>.<field>".
-- The checklist definition lives in code (lib/intake.ts) — changing the
-- checklist never needs a migration.

create table public.intakes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.intakes enable row level security;

create policy "org members manage intakes" on public.intakes
  for all using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());
