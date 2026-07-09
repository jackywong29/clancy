-- 011 — configurable client CRM (Batch 5, 2026-07-10)
-- Each workspace gets a crm_config (like sites.config) defining what a
-- "record" is called and its custom fields. Record values live in
-- clients.custom (JSONB) so new fields never need a migration. Clancy's
-- own workspace keeps its dedicated sales board (separate code path);
-- this drives CLIENT workspaces.

alter table public.organizations
  add column if not exists crm_config jsonb not null default '{}'::jsonb;

alter table public.clients
  add column if not exists custom jsonb not null default '{}'::jsonb;

-- Workspace members (and platform admins) can update their org's config.
drop policy if exists "org members update org" on public.organizations;
create policy "org members update org" on public.organizations
  for update using (id = public.auth_org_id())
  with check (id = public.auth_org_id());

drop policy if exists "platform admin updates orgs" on public.organizations;
create policy "platform admin updates orgs" on public.organizations
  for update using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Seed SGCKL's CRM: a visitor-retention tracker (matches its pipeline).
update public.organizations
set crm_config = '{
  "record_singular": "Visitor",
  "record_plural": "Visitors",
  "fields": [
    { "key": "first_visit", "label": "First visit", "type": "date" },
    { "key": "how_heard", "label": "How they heard of us", "type": "text" },
    { "key": "cell_group", "label": "Cell group", "type": "text" },
    { "key": "invited_by", "label": "Invited by", "type": "text" }
  ],
  "card_fields": ["first_visit", "cell_group"],
  "modules": { "tasks": false, "calendar": false }
}'::jsonb
where slug = 'sgckl';
