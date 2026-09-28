-- 021 verification — run in the Supabase SQL editor AFTER 021_security_hardening.sql.
--
-- Builds two throwaway workspaces, tries to break each rule 021 added, then
-- ROLLS EVERYTHING BACK. Nothing it creates survives the run; no real
-- workspace is read or touched. It also creates and immediately discards one
-- throwaway auth user, because the invite rules can only be exercised through
-- the auth.users triggers.
--
-- Expected: the first row says "ALL n CHECKS PASSED". Any FAIL row names what
-- broke — paste the output back to Claude. Rows starting "skipped" are not
-- failures: they mean this environment would not let the check run.
--
-- Note: the SQL editor runs as a superuser with no signed-in user, so
-- auth.uid() and auth_org_id() are null throughout. That is exactly what the
-- "refuses an unauthenticated caller" checks rely on; it also means row-level
-- security is not what is being exercised here — the rules are.

create or replace function pg_temp.verify_021()
returns table (check_name text, result text)
language plpgsql
as $$
declare
  names text[] := '{}';
  results text[] := '{}';
  v_org uuid;
  v_org_b uuid;
  s1 uuid;
  sb1 uuid;
  cb1 uuid;
  ca uuid;
  v_slug text := 'verify-021-' || replace(gen_random_uuid()::text, '-', '');
  v_token uuid;
  v_msg text;
  v_n integer;
  v_txt text;
  v_json jsonb;
  v_uid uuid := gen_random_uuid();
  v_uid2 uuid := gen_random_uuid();
  v_email text := 'verify021-' || replace(gen_random_uuid()::text, '-', '') || '@example.test';
  v_email2 text := 'verify021-' || replace(gen_random_uuid()::text, '-', '') || '@example.test';
  v_authuser boolean := false;
  v_skipmsg text;
  v_expires timestamptz;
  v_profile_org uuid;
begin
  -- PL/pgSQL variables are not transactional: they keep their values after
  -- the inner block below is rolled back, which is how the results get out.
  begin
    insert into organizations (name, slug)
      values ('verify-021-a', v_slug || '-a') returning id into v_org;
    insert into organizations (name, slug)
      values ('verify-021-b', v_slug || '-b') returning id into v_org_b;

    insert into pipeline_stages (organization_id, name, position, checklist)
      values (v_org, 'Enquiry', 1, '[{"title":"Call them"}]'::jsonb)
      returning id into s1;
    insert into pipeline_stages (organization_id, name, position, checklist)
      values (v_org_b, 'Other workspace stage', 1,
              '[{"title":"SECRET neighbouring checklist item"}]'::jsonb)
      returning id into sb1;

    insert into clients (organization_id, company_name, stage_id)
      values (v_org_b, 'Neighbour Co', sb1) returning id into cb1;

    -- =====================================================================
    -- M1 — the anonymous website form
    -- =====================================================================
    insert into sites (organization_id, slug, published, config)
      values (v_org, v_slug, true, '{}'::jsonb);

    -- 1: form switched off (the flag is absent) is refused
    v_msg := null;
    begin
      perform submit_lead(v_slug, '{"name":"Walk in"}'::jsonb);
    exception when others then v_msg := sqlerrm;
    end;
    names := array_append(names, 'submit_lead refuses a site with the form switched off');
    results := array_append(results, case
      when v_msg like 'signup form is not enabled%' then 'ok'
      else 'FAIL — got ' || coalesce(v_msg, 'no error') end);

    -- 2: an unpublished site is still refused
    update sites set config = '{"form_enabled": true}'::jsonb, published = false
      where slug = v_slug;
    v_msg := null;
    begin
      perform submit_lead(v_slug, '{"name":"Walk in"}'::jsonb);
    exception when others then v_msg := sqlerrm;
    end;
    names := array_append(names, 'submit_lead still refuses an unpublished site');
    results := array_append(results, case
      when v_msg = 'unknown site' then 'ok'
      else 'FAIL — got ' || coalesce(v_msg, 'no error') end);

    -- 3-4: with the form on, a lead lands and every field is capped
    update sites set published = true where slug = v_slug;
    v_msg := null;
    begin
      perform submit_lead(v_slug, jsonb_build_object(
        'name', repeat('n', 500),
        'phone', repeat('9', 500),
        'email', repeat('e', 500),
        'message', repeat('m', 9000)
      ));
    exception when others then v_msg := sqlerrm;
    end;
    names := array_append(names, 'submit_lead accepts a lead once the form is on');
    results := array_append(results, case
      when v_msg is null then 'ok' else 'FAIL — ' || v_msg end);

    select length(company_name) || '/' || length(phone) || '/' || length(email) || '/' || length(notes)
      into v_txt
      from clients
      where organization_id = v_org and source = 'website form'
      order by created_at desc limit 1;
    names := array_append(names, 'submit_lead caps name/phone/email at 200 and message at 4000');
    results := array_append(results, case
      when v_txt = '200/200/200/4000' then 'ok'
      else 'FAIL — got ' || coalesce(v_txt, 'no row') end);

    -- 5: 20 website-form records an hour is the ceiling
    insert into clients (organization_id, company_name, source)
      select v_org, 'bulk ' || g, 'website form' from generate_series(1, 19) g;
    v_msg := null;
    begin
      perform submit_lead(v_slug, '{"name":"One too many"}'::jsonb);
    exception when others then v_msg := sqlerrm;
    end;
    names := array_append(names, 'submit_lead rate limits at 20 website leads an hour');
    results := array_append(results, case
      when v_msg like 'too many signups%' then 'ok'
      else 'FAIL — got ' || coalesce(v_msg, 'no error') end);

    -- =====================================================================
    -- M3 — foreign keys must agree on organization_id
    -- =====================================================================
    -- 6: a record cannot point at another workspace's stage
    v_msg := null;
    begin
      insert into clients (organization_id, company_name, stage_id)
        values (v_org, 'Planted', sb1);
    exception when others then v_msg := sqlstate;
    end;
    names := array_append(names, 'a record cannot point at another workspace stage');
    results := array_append(results, case
      when v_msg = '23503' then 'ok'
      else 'FAIL — expected a foreign key violation, got ' || coalesce(v_msg, 'no error') end);

    -- 7: a task cannot point at another workspace's record
    v_msg := null;
    begin
      insert into tasks (organization_id, client_id, title)
        values (v_org, cb1, 'Planted task');
    exception when others then v_msg := sqlstate;
    end;
    names := array_append(names, 'a task cannot point at another workspace record');
    results := array_append(results, case
      when v_msg = '23503' then 'ok'
      else 'FAIL — expected a foreign key violation, got ' || coalesce(v_msg, 'no error') end);

    -- 8: a task cannot claim another workspace's stage as its origin
    v_msg := null;
    begin
      insert into tasks (organization_id, title, origin_stage_id)
        values (v_org, 'Planted origin', sb1);
    exception when others then v_msg := sqlstate;
    end;
    names := array_append(names, 'a task cannot originate from another workspace stage');
    results := array_append(results, case
      when v_msg = '23503' then 'ok'
      else 'FAIL — expected a foreign key violation, got ' || coalesce(v_msg, 'no error') end);

    -- 9: an event cannot point at another workspace's record
    v_msg := null;
    begin
      insert into events (organization_id, client_id, title, starts_on)
        values (v_org, cb1, 'Planted event', current_date);
    exception when others then v_msg := sqlstate;
    end;
    names := array_append(names, 'an event cannot point at another workspace record');
    results := array_append(results, case
      when v_msg = '23503' then 'ok'
      else 'FAIL — expected a foreign key violation, got ' || coalesce(v_msg, 'no error') end);

    -- 10: the four composite foreign keys exist and carry organization_id.
    --     tasks.assignee_id is deliberately NOT among them: it would point at
    --     (profiles.id, profiles.organization_id), and that pair moves every
    --     time the workspace switcher updates a profile. It is guarded by the
    --     tasks_assignee_guard trigger instead — asserted next.
    select count(*) into v_n
      from pg_constraint
      where conname in (
        'clients_stage_org_fkey', 'tasks_client_org_fkey',
        'tasks_origin_stage_org_fkey', 'events_client_org_fkey')
        and contype = 'f'
        and pg_get_constraintdef(oid) like '%organization_id%';
    names := array_append(names, 'all four composite foreign keys are in place');
    results := array_append(results, case
      when v_n = 4 then 'ok' else 'FAIL — found ' || v_n || ' of 4' end);

    -- 10b: the assignee rule is enforced by a trigger rather than a
    --      constraint. Proving it at runtime would need a profile in the
    --      other workspace, which needs an auth.users row this script does
    --      not create — so, as with checks 11-12, the installed body is
    --      asserted instead.
    select count(*) into v_n
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
      where t.tgrelid = 'public.tasks'::regclass
        and t.tgname = 'tasks_assignee_guard'
        and not t.tgisinternal
        and pg_get_functiondef(p.oid) like '%organization_id%';
    names := array_append(names, 'tasks.assignee_id is guarded by an org-scoped trigger');
    results := array_append(results, case
      when v_n = 1 then 'ok'
      else 'FAIL — tasks_assignee_guard missing or not org-scoped' end);

    -- 11-12: the two definer functions that read a stage now scope that read
    --     to the record's own workspace. The rows that would prove it at
    --     runtime can no longer be created (checks 6-9 above), so the guard
    --     is asserted against the installed function body instead.
    select count(*) into v_n
      from pg_proc
      where proname = 'generate_stage_tasks'
        and pronamespace = 'public'::regnamespace
        and prosrc like '%and organization_id = v_client.organization_id%';
    names := array_append(names, 'generate_stage_tasks scopes the checklist read to the workspace');
    results := array_append(results, case when v_n = 1 then 'ok' else 'FAIL' end);

    select count(*) into v_n
      from pg_proc
      where proname = 'clients_stage_guard'
        and pronamespace = 'public'::regnamespace
        and prosrc like '%and organization_id = new.organization_id%';
    names := array_append(names, 'clients_stage_guard scopes both position lookups to the workspace');
    results := array_append(results, case when v_n = 1 then 'ok' else 'FAIL' end);

    -- 13: the blocking rule from 020 still works after the rewrite
    insert into clients (organization_id, company_name, stage_id)
      values (v_org, 'Still blocking', s1) returning id into ca;
    select count(*) into v_n from tasks where client_id = ca and origin_stage_id = s1;
    names := array_append(names, '020 checklist generation still fires after the 021 rewrite');
    results := array_append(results, case when v_n = 1 then 'ok' else 'FAIL — got ' || v_n end);

    -- =====================================================================
    -- M7 + L5 — the public intake link
    -- =====================================================================
    insert into intakes (organization_id, client_id, data) values (v_org, ca, jsonb_build_object(
      'basics.registered_name', 'STAFF ANSWER',
      'contact.phone', '0123456789',
      'access.gbp', 'granted - internal only',
      'access.customer_list', 'intake-files/secret-path.csv',
      'branding.logo', 'intake-files/secret-logo.png'
    ));
    select intake_token into v_token from clients where id = ca;

    -- 14: only client-facing keys come back
    v_json := intake_by_token(v_token);
    names := array_append(names, 'intake_by_token returns only client-facing answers');
    results := array_append(results, case
      when v_json->'data' ? 'basics.registered_name'
        and not (v_json->'data' ? 'access.gbp')
        and not (v_json->'data' ? 'access.customer_list')
        and not (v_json->'data' ? 'branding.logo')
      then 'ok'
      else 'FAIL — got keys ' ||
        coalesce((select string_agg(k, ', ') from jsonb_object_keys(v_json->'data') k), 'none') end);

    -- 15: an anonymous write cannot overwrite a staff answer
    perform save_intake_by_token(v_token, jsonb_build_object(
      'basics.registered_name', 'CLIENT ANSWER',
      'access.gbp', 'client tried to write this',
      'faq.tone', 'friendly'
    ));
    select data into v_json from intakes where client_id = ca;
    names := array_append(names, 'a client answer never overwrites the staff answer');
    results := array_append(results, case
      when v_json->>'basics.registered_name' = 'STAFF ANSWER'
        and v_json->'_client'->>'basics.registered_name' = 'CLIENT ANSWER'
      then 'ok'
      else 'FAIL — staff value is now ' || coalesce(v_json->>'basics.registered_name', 'null') end);

    -- 16: non-client-facing keys are dropped on the way in
    names := array_append(names, 'an anonymous write cannot store a non-client-facing key');
    results := array_append(results, case
      when not (v_json->'_client' ? 'access.gbp')
        and v_json->'_client' ? 'faq.tone'
        and v_json->>'access.gbp' = 'granted - internal only'
      then 'ok' else 'FAIL — stored ' || coalesce((v_json->'_client')::text, 'null') end);

    -- 17: the client still sees their own answer, and never the reserved key
    v_json := intake_by_token(v_token);
    names := array_append(names, 'the client sees their own answer, not the reserved key');
    results := array_append(results, case
      when v_json->'data'->>'basics.registered_name' = 'CLIENT ANSWER'
        and not (v_json->'data' ? '_client')
      then 'ok'
      else 'FAIL — got ' || coalesce((v_json->'data')::text, 'null') end);

    -- 18: oversized anonymous writes are refused
    v_msg := null;
    begin
      perform save_intake_by_token(v_token,
        jsonb_build_object('faq.questions', repeat('x', 200000)));
    exception when others then v_msg := sqlerrm;
    end;
    names := array_append(names, 'save_intake_by_token refuses an oversized payload');
    results := array_append(results, case
      when v_msg = 'submission too large' then 'ok'
      else 'FAIL — got ' || coalesce(v_msg, 'no error') end);

    -- 19-20: an expired link reads nothing and writes nothing
    update clients set intake_token_expires_at = now() - interval '1 day' where id = ca;
    names := array_append(names, 'an expired intake link returns nothing');
    results := array_append(results, case
      when intake_by_token(v_token) is null then 'ok' else 'FAIL — still readable' end);

    v_msg := null;
    begin
      perform save_intake_by_token(v_token, jsonb_build_object('faq.tone', 'late'));
    exception when others then v_msg := sqlerrm;
    end;
    names := array_append(names, 'an expired intake link cannot be written to');
    results := array_append(results, case
      when v_msg = 'intake link expired' then 'ok'
      else 'FAIL — got ' || coalesce(v_msg, 'no error') end);

    -- 21: rotation is refused when nobody is signed in
    v_msg := null;
    begin
      perform regenerate_intake_token(ca);
    exception when others then v_msg := sqlerrm;
    end;
    names := array_append(names, 'regenerate_intake_token refuses an unauthenticated caller');
    results := array_append(results, case
      when v_msg like 'Not allowed%' then 'ok'
      else 'FAIL — got ' || coalesce(v_msg, 'no error') end);

    -- 22: the key list matches lib/intake.ts (25 client-facing fields)
    select array_length(client_facing_intake_keys(), 1) into v_n;
    names := array_append(names, 'the client-facing key list has all 25 fields');
    results := array_append(results, case
      when v_n = 25 then 'ok' else 'FAIL — got ' || coalesce(v_n::text, 'null') end);

    -- =====================================================================
    -- M2 — set_member_role
    -- =====================================================================
    -- 23: refused outright with nobody signed in
    v_msg := null;
    begin
      perform set_member_role(gen_random_uuid(), 'viewer', null);
    exception when others then v_msg := sqlerrm;
    end;
    names := array_append(names, 'set_member_role refuses an unauthenticated caller');
    results := array_append(results, case
      when v_msg like 'Not allowed%' then 'ok'
      else 'FAIL — got ' || coalesce(v_msg, 'no error') end);

    -- 24: anon holds no grant on either new RPC; authenticated does
    names := array_append(names, 'set_member_role + regenerate_intake_token are authenticated-only');
    results := array_append(results, case
      when not has_function_privilege('anon', 'public.set_member_role(uuid,text,text)', 'execute')
       and not has_function_privilege('anon', 'public.regenerate_intake_token(uuid)', 'execute')
       and has_function_privilege('authenticated', 'public.set_member_role(uuid,text,text)', 'execute')
       and has_function_privilege('authenticated', 'public.regenerate_intake_token(uuid)', 'execute')
      then 'ok' else 'FAIL' end);

    -- 25: every function 021 touches is SECURITY DEFINER with a pinned path
    select count(*) into v_n
      from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname in ('set_member_role', 'regenerate_intake_token', 'claim_org_invite',
                        'handle_new_user', 'handle_user_confirmed', 'submit_lead',
                        'intake_by_token', 'save_intake_by_token',
                        'generate_stage_tasks', 'clients_stage_guard')
        and prosecdef
        and array_to_string(coalesce(proconfig, '{}'), ',') like '%search_path=public%';
    names := array_append(names, 'all ten touched functions are definer with search_path pinned');
    results := array_append(results, case
      when v_n = 10 then 'ok' else 'FAIL — only ' || v_n || ' of 10' end);

    -- =====================================================================
    -- L1 + L6 — policies
    -- =====================================================================
    -- 26: the organizations UPDATE policy now demands the admin role
    select count(*) into v_n
      from pg_policies
      where schemaname = 'public' and tablename = 'organizations'
        and policyname = 'org members update org'
        and qual like '%auth_role%' and with_check like '%auth_role%';
    names := array_append(names, 'only a workspace admin can update the organization row');
    results := array_append(results, case when v_n = 1 then 'ok' else 'FAIL' end);

    -- 27: the broadcast-files policy names its role
    select count(*) into v_n
      from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'org members manage broadcast files'
        and 'authenticated' = any (roles) and not ('public' = any (roles));
    names := array_append(names, 'the broadcast-files policy applies to authenticated only');
    results := array_append(results, case when v_n = 1 then 'ok' else 'FAIL' end);

    -- =====================================================================
    -- H3 — invites are granted on confirmation, not on signup
    -- =====================================================================
    insert into org_invites (organization_id, email, role, department)
      values (v_org, v_email, 'editor', 'Workshop')
      returning expires_at into v_expires;

    -- 28: invites now expire
    names := array_append(names, 'a new invite gets a 14 day expiry');
    results := array_append(results, case
      when v_expires between now() + interval '13 days' and now() + interval '15 days'
      then 'ok' else 'FAIL — got ' || coalesce(v_expires::text, 'null') end);

    -- The remaining invite checks need a real auth.users row, because the
    -- rules live in triggers on that table. If this environment will not
    -- allow the insert, they are reported as skipped rather than failed.
    begin
      insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at, updated_at)
        values (v_uid, v_email, 'authenticated', 'authenticated', '{}'::jsonb, now(), now());
      v_authuser := true;
    exception when others then
      v_authuser := false;
      v_skipmsg := sqlerrm;
    end;

    if not v_authuser then
      names := array_append(names, 'signup does not consume the invite (needs auth.users)');
      results := array_append(results, 'skipped — ' || coalesce(v_skipmsg, 'could not create a test auth user'));
    else
      -- 29: signing up unconfirmed leaves the invite alone and the profile org-less
      select count(*) into v_n from org_invites where email = v_email;
      select organization_id into v_profile_org from profiles where id = v_uid;
      names := array_append(names, 'an unconfirmed signup neither joins the workspace nor burns the invite');
      results := array_append(results, case
        when v_n = 1 and v_profile_org is null then 'ok'
        else 'FAIL — invites left ' || v_n || ', org ' || coalesce(v_profile_org::text, 'null') end);

      -- 30: confirming the address claims the invite, at the invited role
      update auth.users set email_confirmed_at = now() where id = v_uid;
      select organization_id into v_profile_org from profiles where id = v_uid;
      select role || '/' || coalesce(department, '-') into v_txt from profiles where id = v_uid;
      select count(*) into v_n from org_invites where email = v_email;
      names := array_append(names, 'confirming the address joins the workspace at the invited role');
      results := array_append(results, case
        when v_profile_org = v_org and v_txt = 'editor/Workshop' and v_n = 0 then 'ok'
        else 'FAIL — org ' || coalesce(v_profile_org::text, 'null') || ', role ' || coalesce(v_txt, 'null')
             || ', invites left ' || v_n end);

      -- 31: an expired invite is never claimed
      insert into org_invites (organization_id, email, role, expires_at)
        values (v_org, v_email2, 'admin', now() - interval '1 day');
      insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
        values (v_uid2, v_email2, 'authenticated', 'authenticated', '{}'::jsonb, now(), now(), now());
      select organization_id into v_profile_org from profiles where id = v_uid2;
      names := array_append(names, 'an expired invite grants nothing');
      results := array_append(results, case
        when v_profile_org is null then 'ok'
        else 'FAIL — joined ' || coalesce(v_profile_org::text, 'null') end);
    end if;

    -- Throw everything above away.
    raise exception 'verify_021_rollback';
  exception when others then
    if sqlerrm <> 'verify_021_rollback' then
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

select * from pg_temp.verify_021();
