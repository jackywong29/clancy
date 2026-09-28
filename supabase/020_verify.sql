-- 020 verification — run in the Supabase SQL editor AFTER 020_stage_integrity_dashboard.sql.
--
-- Builds a throwaway workspace with three stages, pushes one record through
-- every rule the triggers enforce, then ROLLS EVERYTHING BACK. Nothing it
-- creates survives the run; no real workspace is read or touched.
--
-- Expected: the first row says "ALL 15 CHECKS PASSED". Any FAIL row names
-- what broke — paste the output back to Claude.
--
-- Note: the SQL editor runs as a superuser with no signed-in user, so this
-- exercises the rules, not row-level security (created_by/moved_by are null).

create or replace function pg_temp.verify_020()
returns table (check_name text, result text)
language plpgsql
as $$
declare
  names text[] := '{}';
  results text[] := '{}';
  v_org uuid;
  s1 uuid;
  s2 uuid;
  s3 uuid;
  c1 uuid;
  v_n integer;
  v_entered timestamptz;
  v_stage uuid;
  v_msg text;
  v_due date;
  v_blocker uuid;
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  -- PL/pgSQL variables are not transactional: they keep their values after
  -- the inner block below is rolled back, which is how the results get out.
  begin
    insert into organizations (name, slug)
      values ('verify-020', 'verify-020-' || gen_random_uuid())
      returning id into v_org;

    insert into pipeline_stages (organization_id, name, position, checklist)
      values (v_org, 'Enquiry', 1,
        '[{"title":"Call them"},{"title":"Log source"}]'::jsonb)
      returning id into s1;
    insert into pipeline_stages (organization_id, name, position, checklist)
      values (v_org, 'Diagnosis', 2,
        '[{"title":"Take photos","due_in_days":2},{"title":"Customer approved quote","blocking":true}]'::jsonb)
      returning id into s2;
    insert into pipeline_stages (organization_id, name, position, checklist)
      values (v_org, 'Done', 3,
        '[{"title":"Final check","blocking":true}]'::jsonb)
      returning id into s3;

    -- 1-3: a new record gets the clock, its checklist, and a history row
    insert into clients (organization_id, company_name, stage_id)
      values (v_org, 'Verify Co', s1)
      returning id into c1;

    select stage_entered_at into v_entered from clients where id = c1;
    names := array_append(names, 'insert sets stage_entered_at');
    results := array_append(results, case when v_entered is not null then 'ok' else 'FAIL' end);

    select count(*) into v_n from tasks where client_id = c1 and origin_stage_id = s1;
    names := array_append(names, 'insert creates the stage checklist (2 tasks)');
    results := array_append(results, case when v_n = 2 then 'ok' else 'FAIL — got ' || v_n end);

    select count(*) into v_n from stage_transitions where client_id = c1;
    names := array_append(names, 'insert records one transition');
    results := array_append(results, case when v_n = 1 then 'ok' else 'FAIL — got ' || v_n end);

    -- 4: editing another field (the edit form re-sends the SAME stage_id)
    --    must not reset the clock or add history
    update clients set stage_entered_at = now() - interval '5 days' where id = c1;
    update clients set phone = '0123456789', stage_id = s1 where id = c1;
    select stage_entered_at into v_entered from clients where id = c1;
    select count(*) into v_n from stage_transitions where client_id = c1;
    names := array_append(names, 'editing a field keeps the clock and history');
    results := array_append(results, case
      when v_entered < now() - interval '4 days' and v_n = 1 then 'ok'
      else 'FAIL — clock ' || v_entered || ', transitions ' || v_n end);

    -- 5-7: forward move with nothing blocking is allowed, resets the clock,
    --      creates the new stage's tasks with a Malaysia-time due date
    update clients set stage_id = s2 where id = c1;
    select stage_entered_at into v_entered from clients where id = c1;
    names := array_append(names, 'forward move resets the clock');
    results := array_append(results, case
      when v_entered > now() - interval '1 minute' then 'ok' else 'FAIL' end);

    select count(*) into v_n from tasks where client_id = c1 and origin_stage_id = s2;
    names := array_append(names, 'forward move creates the next checklist (2 tasks)');
    results := array_append(results, case when v_n = 2 then 'ok' else 'FAIL — got ' || v_n end);

    select due_date into v_due from tasks
      where client_id = c1 and origin_stage_id = s2 and title = 'Take photos';
    names := array_append(names, 'due_in_days counts from today in Malaysia');
    results := array_append(results, case
      when v_due = v_today + 2 then 'ok' else 'FAIL — got ' || coalesce(v_due::text, 'null') end);

    -- 8-9: forward move past an unfinished blocker is refused, and names only
    --      the blocking item — then the record is still where it was
    v_msg := null;
    begin
      update clients set stage_id = s3 where id = c1;
    exception when others then
      v_msg := sqlerrm;
    end;
    names := array_append(names, 'forward move past a blocker is refused');
    results := array_append(results, case
      when v_msg = 'Finish first: Customer approved quote' then 'ok'
      else 'FAIL — got ' || coalesce(v_msg, 'no error') end);

    select stage_id into v_stage from clients where id = c1;
    names := array_append(names, 'refused move leaves the record in place');
    results := array_append(results, case when v_stage = s2 then 'ok' else 'FAIL' end);

    -- 10: ticking done stamps completed_at
    select id into v_blocker from tasks
      where client_id = c1 and title = 'Customer approved quote';
    update tasks set status = 'done' where id = v_blocker;
    select count(*) into v_n from tasks where id = v_blocker and completed_at is not null;
    names := array_append(names, 'ticking done stamps completed_at');
    results := array_append(results, case when v_n = 1 then 'ok' else 'FAIL' end);

    -- 11: once the blocker is done, the forward move goes through
    v_msg := null;
    begin
      update clients set stage_id = s3 where id = c1;
    exception when others then
      v_msg := sqlerrm;
    end;
    names := array_append(names, 'forward move allowed once the blocker is done');
    results := array_append(results, case when v_msg is null then 'ok' else 'FAIL — ' || v_msg end);

    -- 12: backward moves are never blocked, even with a blocker pending
    --     (Done's "Final check" is blocking and unfinished right now)
    v_msg := null;
    begin
      update clients set stage_id = s1 where id = c1;
    exception when others then
      v_msg := sqlerrm;
    end;
    names := array_append(names, 'backward move is never blocked');
    results := array_append(results, case when v_msg is null then 'ok' else 'FAIL — ' || v_msg end);

    -- 13: coming back to a stage never duplicates its tasks
    update clients set stage_id = s2 where id = c1;
    select count(*) into v_n from tasks where client_id = c1 and origin_stage_id = s2;
    names := array_append(names, 'returning to a stage creates no duplicates');
    results := array_append(results, case when v_n = 2 then 'ok' else 'FAIL — got ' || v_n end);

    -- 14: reopening a task clears completed_at
    update tasks set status = 'pending' where id = v_blocker;
    select count(*) into v_n from tasks where id = v_blocker and completed_at is null;
    names := array_append(names, 'reopening clears completed_at');
    results := array_append(results, case when v_n = 1 then 'ok' else 'FAIL' end);

    -- 15: the button's function is idempotent too
    select generate_stage_tasks(c1) into v_n;
    names := array_append(names, 'generate_stage_tasks adds nothing when complete');
    results := array_append(results, case when v_n = 0 then 'ok' else 'FAIL — created ' || v_n end);

    -- Throw everything above away.
    raise exception 'verify_020_rollback';
  exception when others then
    if sqlerrm <> 'verify_020_rollback' then
      names := array_append(names, 'UNEXPECTED ERROR (the run stopped here)');
      results := array_append(results, ('FAIL — ' || sqlerrm));
    end if;
  end;

  check_name := case
    when not ('FAIL' = any (select left(r, 4) from unnest(results) r))
      then 'ALL ' || array_length(names, 1) || ' CHECKS PASSED'
    else (select count(*) from unnest(results) r where r like 'FAIL%') || ' CHECK(S) FAILED'
  end;
  result := 'nothing was saved — everything above was rolled back';
  return next;

  return query select unnest(names), unnest(results);
end;
$$;

select * from pg_temp.verify_020();
