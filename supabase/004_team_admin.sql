-- 004 — team management + one-time bootstrap (2026-07-07)
-- Adds email + platform-admin flag to profiles so access is managed from
-- inside Clancy HQ (/team) instead of SQL. The bootstrap block makes all
-- currently-existing users platform admins with Clancy access (they are
-- all Jacky at time of running).

alter table public.profiles add column email text;
alter table public.profiles add column is_platform_admin boolean not null default false;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end;
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

create policy "platform admin reads all profiles" on public.profiles
  for select using (public.is_platform_admin());

create policy "platform admin updates profiles" on public.profiles
  for update using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "platform admin reads all orgs" on public.organizations
  for select using (public.is_platform_admin());

-- One-time bootstrap
update public.profiles set is_platform_admin = true;

update public.profiles
set organization_id = (select id from public.organizations where slug = 'clancy')
where organization_id is null;
