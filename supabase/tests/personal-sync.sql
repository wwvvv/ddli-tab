\set ON_ERROR_STOP on
begin;
set local role anon;
do $$ begin
  begin perform * from public.dtab_snapshots; raise exception 'FAIL anon read'; exception when insufficient_privilege then null; end;
  begin perform public.dtab_push_snapshot(0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{}'); raise exception 'FAIL anon RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ declare r jsonb; begin
  r:=public.dtab_push_snapshot(0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"appData":{"listData":[]}}');
  if r->>'status'<>'ok' or (r->>'revision')::int<>1 then raise exception 'FAIL initial write'; end if;
  r:=public.dtab_push_snapshot(0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"appData":{"listData":[]}}');
  if (r->>'revision')::int<>1 then raise exception 'FAIL idempotent retry'; end if;
  r:=public.dtab_push_snapshot(0,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{}');
  if r->>'status'<>'conflict' then raise exception 'FAIL stale overwrite'; end if;
  begin perform public.dtab_push_snapshot(1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{}'); raise exception 'FAIL reused request'; exception when invalid_parameter_value then null; end;
  begin perform public.dtab_push_snapshot(1,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','{"user":{"token":"not-real"}}'); raise exception 'FAIL token module'; exception when invalid_parameter_value then null; end;
  begin update public.dtab_snapshots set payload='{}'; raise exception 'FAIL direct update'; exception when insufficient_privilege then null; end;
  begin delete from public.dtab_snapshots; raise exception 'FAIL direct delete'; exception when insufficient_privilege then null; end;
  begin insert into public.dtab_snapshots(user_id) values('22222222-2222-4222-8222-222222222222'); raise exception 'FAIL direct insert'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ declare n int; begin
  select count(*) into n from public.dtab_snapshots;
  if n<>0 then raise exception 'FAIL cross-account read'; end if;
  perform public.dtab_push_snapshot(0,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','{"card":{"radius":22}}');
  select count(*) into n from public.dtab_snapshots;
  if n<>1 then raise exception 'FAIL own row read'; end if;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  begin perform public.dtab_push_snapshot(0,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','{}'); raise exception 'FAIL missing identity'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
\echo DTab SQL permission and revision tests passed
