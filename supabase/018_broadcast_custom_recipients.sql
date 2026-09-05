-- 018 — free-typed broadcast recipients
--
-- Until now a broadcast's audience was a picker only ('all', 'stage:<id>',
-- 'team', 'role:<r>', 'dept:<key>'). This adds ad-hoc addresses typed straight
-- into the compose box, either on their own ('custom') or on top of a picked
-- audience.
--
-- Stored as its own column rather than stuffed into the existing `audience`
-- text field: a pasted list of 40 addresses would make that column unreadable
-- and would break the audience label shown on the broadcasts list.

alter table public.broadcasts
  add column if not exists custom_recipients jsonb not null default '[]'::jsonb;
