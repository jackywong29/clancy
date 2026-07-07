-- 002 — open signup safely (2026-07-07)
-- New auth users no longer auto-join the Clancy org. They get an org-less
-- profile (RLS blocks everything) and see the no-access page until Jacky
-- assigns them. Grant access manually with:
--   update public.profiles
--   set organization_id = (select id from public.organizations where slug = 'clancy')
--   where id = '<user uuid from Authentication -> Users>';

alter table public.profiles alter column organization_id drop not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;
