-- 005 — repair (2026-07-07): profiles table was found emptied in production.
-- Idempotent rebuild: recreates missing profile rows from auth.users,
-- re-applies 004's columns/functions/policies, re-seeds org/stages if
-- missing, and re-bootstraps existing users as platform admins with
-- Clancy access. Safe to run repeatedly.

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists is_platform_admin boolean not null default false;

insert into public.organizations (name, slug)
select 'Clancy', 'clancy'
where not exists (select 1 from public.organizations where slug = 'clancy');

insert into public.pipeline_stages (organization_id, name, position)
select o.id, s.name, s.position
from public.organizations o,
  (values ('Lead',1),('Pitched',2),('Intake',3),('Trial live',4),
          ('Signed',5),('Onboarding',6),('Active',7),('Renewal due',8)) as s(name, position)
where o.slug = 'clancy'
  and not exists (select 1 from public.pipeline_stages ps where ps.organization_id = o.id);

insert into public.profiles (id, full_name, email)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', ''), u.email
from auth.users u
where u.id not in (select id from public.profiles);

update public.profiles set is_platform_admin = true;
update public.profiles
set organization_id = (select id from public.organizations where slug = 'clancy')
where organization_id is null;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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

drop policy if exists "platform admin reads all profiles" on public.profiles;
create policy "platform admin reads all profiles" on public.profiles
  for select using (public.is_platform_admin());

drop policy if exists "platform admin updates profiles" on public.profiles;
create policy "platform admin updates profiles" on public.profiles
  for update using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "platform admin reads all orgs" on public.organizations;
create policy "platform admin reads all orgs" on public.organizations
  for select using (public.is_platform_admin());
