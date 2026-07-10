-- 014 — richer calendar events + site favicon (Batch 8)
-- Events gain start/end times, all-day flag, recurrence, and alert
-- departments. Recurrence is expanded at read time by the calendar (no row
-- per occurrence). favicon_url lives in sites.config (jsonb) — no DDL for it.

alter table public.events add column if not exists ends_on date;
alter table public.events add column if not exists end_time text;
alter table public.events add column if not exists all_day boolean not null default false;
alter table public.events add column if not exists repeat text not null default 'none';
alter table public.events add column if not exists alert_departments jsonb not null default '[]'::jsonb;
alter table public.events add column if not exists alert_minutes integer;
