-- Apply after 202609100001. No snapshot rows or existing migrations are rewritten.
-- Old clients deliberately lose RPC write access until they update.
begin;
revoke all on function public.dtab_push_snapshot(bigint,uuid,jsonb)
  from public, anon, authenticated;

create function public.dtab_push_snapshot(
  p_base_revision bigint,
  p_request_id uuid,
  p_payload jsonb,
  p_expected_owner uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
begin
  -- The expectation is only a guard. auth.uid(), never a client parameter,
  -- remains the row owner used by the original, now-internal write function.
  if caller is null or p_expected_owner is distinct from caller then
    raise exception 'Sync owner changed; update or sign in again' using errcode = '42501';
  end if;
  return public.dtab_push_snapshot(p_base_revision, p_request_id, p_payload);
end;
$$;
revoke all on function public.dtab_push_snapshot(bigint,uuid,jsonb,uuid)
  from public, anon, authenticated;
grant execute on function public.dtab_push_snapshot(bigint,uuid,jsonb,uuid)
  to authenticated;
notify pgrst, 'reload schema';
commit;
