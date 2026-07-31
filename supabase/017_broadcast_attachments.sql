-- 017 — broadcast attachments (files + inline images on email broadcasts)
--
-- Files go in a PRIVATE bucket on purpose: a client's price list, member
-- notice or event flyer should not sit world-readable at a guessable URL
-- (site-assets is public and is the wrong home for this). The server
-- downloads each file under the caller's own session and hands nodemailer a
-- buffer; inline images are embedded via cid, so nothing ever needs a public
-- URL. In mail-app fallback mode we mint 7-day signed links instead.
--
-- Email signatures need no DDL — they live in organizations.crm_config
-- under `signature`, so every workspace gets its own automatically.

alter table public.broadcasts
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- Private bucket, org-scoped paths: <organization_id>/<draft-or-broadcast-id>/<file>
insert into storage.buckets (id, name, public)
values ('broadcast-files', 'broadcast-files', false)
on conflict (id) do nothing;

drop policy if exists "org members manage broadcast files" on storage.objects;
create policy "org members manage broadcast files" on storage.objects
  for all
  using (
    bucket_id = 'broadcast-files'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
  )
  with check (
    bucket_id = 'broadcast-files'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
  );
