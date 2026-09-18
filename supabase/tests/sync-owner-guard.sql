\set ON_ERROR_STOP on
begin;
set local role anon;
do $$ begin
  begin
    perform public.dtab_push_snapshot(0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{}',
      '11111111-1111-4111-8111-111111111111');
    raise exception 'FAIL anonymous guarded RPC';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ declare r jsonb; n int; a uuid := '11111111-1111-4111-8111-111111111111'; begin
  -- No bypass for an old client which omits the owner guard.
  begin
    perform public.dtab_push_snapshot(0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{}');
    raise exception 'FAIL legacy RPC still executable';
  exception when insufficient_privilege then null; end;
  begin
    perform public.dtab_push_snapshot(0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{}',null);
    raise exception 'FAIL null expectation';
  exception when insufficient_privilege then null; end;
  select count(*) into n from public.dtab_snapshots;
  if n <> 0 then raise exception 'FAIL rejected calls created a row'; end if;
  r := public.dtab_push_snapshot(0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"card":{"radius":12}}',a);
  if r->>'status' is distinct from 'ok' or r->>'revision' is distinct from '1' then
    raise exception 'FAIL guarded initial write'; end if;
  r := public.dtab_push_snapshot(0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"card":{"radius":12}}',a);
  if r->>'revision' is distinct from '1' then raise exception 'FAIL guarded retry'; end if;
  r := public.dtab_push_snapshot(0,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{}',a);
  if r->>'status' is distinct from 'conflict' then raise exception 'FAIL stale write'; end if;
  begin
    perform public.dtab_push_snapshot(1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{}',a);
    raise exception 'FAIL reused request';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.dtab_push_snapshot(1,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','{"user":{"token":"fixture"}}',a);
    raise exception 'FAIL invalid module';
  exception when invalid_parameter_value then null; end;
  begin
    update public.dtab_snapshots set payload='{}';
    raise exception 'FAIL direct write';
  exception when insufficient_privilege then null; end;
end $$;
-- Dispatch changed from A to B. B has revision 0, matching the stale A request.
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ declare n int; r jsonb; begin
  begin
    perform public.dtab_push_snapshot(0,'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      '{"home":{"privateLabel":"A-only"}}','11111111-1111-4111-8111-111111111111');
    raise exception 'FAIL account-switch write';
  exception when insufficient_privilege then null; end;
  select count(*) into n from public.dtab_snapshots;
  if n <> 0 then raise exception 'FAIL cross-user read or rejected write created B row'; end if;
  r := public.dtab_push_snapshot(0,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    '{"card":{"radius":22}}','22222222-2222-4222-8222-222222222222');
  if r->>'status' is distinct from 'ok' or r->>'revision' is distinct from '1' then
    raise exception 'FAIL B own write'; end if;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  begin
    perform public.dtab_push_snapshot(0,'ffffffff-ffff-4fff-8fff-ffffffffffff','{}',
      '11111111-1111-4111-8111-111111111111');
    raise exception 'FAIL missing JWT';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if (select payload from public.dtab_snapshots where user_id='11111111-1111-4111-8111-111111111111')
    is distinct from '{"card":{"radius":12}}'::jsonb then raise exception 'FAIL A changed'; end if;
  if (select payload from public.dtab_snapshots where user_id='22222222-2222-4222-8222-222222222222')
    is distinct from '{"card":{"radius":22}}'::jsonb then raise exception 'FAIL B contaminated'; end if;
end $$;
rollback;
\echo DTab guarded RPC, account isolation and revision tests passed
