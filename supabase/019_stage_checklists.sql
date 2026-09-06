-- 019 — stage checklists (the SOP layer)
--
-- Tasks that appear automatically when a record enters a stage. This is the
-- piece that turns a pipeline into an actual workflow: "job hits Diagnosis →
-- photograph the vehicle, log parts needed, send the quote."
--
-- The template lives on the stage rather than in crm_config so that a future
-- workflow pack snapshots stages AND their process as one object.
-- Shape: [{ title, details?, department?, due_in_days?, blocking? }]
--
-- origin_stage_id on tasks does two jobs: it makes creation idempotent (move a
-- record out of a stage and back and you don't get duplicate tasks), and it
-- lets the UI ask "how far through this stage's checklist is this record".
-- No CHECK constraints anywhere — validated in the app, per the MSA gotcha.

alter table public.pipeline_stages
  add column if not exists checklist jsonb not null default '[]'::jsonb;

alter table public.tasks
  add column if not exists origin_stage_id uuid
    references public.pipeline_stages(id) on delete set null;

-- Looking up "does this record already have tasks from this stage" happens on
-- every stage move, so index the pair.
create index if not exists tasks_client_origin_stage_idx
  on public.tasks (client_id, origin_stage_id);
