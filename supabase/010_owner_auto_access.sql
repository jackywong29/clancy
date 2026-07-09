-- 010 — owner emails are permanently auto-authorized (2026-07-09)
-- Jacky's emails always land as platform admin in the Clancy workspace,
-- automatically, on signup or re-login — no manual granting, ever. Every
-- OTHER signup still lands org-less (no-access) until granted on /team.
-- To add/remove an owner later, edit the array in both places below.

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

  insert into public.profiles (id, full_name, email, organization_id, is_platform_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    case when is_owner then clancy_org else null end,
    is_owner
  )
  on conflict (id) do update
    set email = excluded.email,
        organization_id = coalesce(public.profiles.organization_id, excluded.organization_id),
        is_platform_admin = public.profiles.is_platform_admin or excluded.is_platform_admin;

  return new;
end;
$$;

-- Fix the currently locked-out owner account(s) right now.
update public.profiles p
set organization_id = coalesce(
      p.organization_id,
      (select id from public.organizations where slug = 'clancy')
    ),
    is_platform_admin = true
from auth.users u
where u.id = p.id
  and u.email = any (array[
    'jackywong0004@gmail.com',
    'clancy.hq.ai@gmail.com'
  ]);
