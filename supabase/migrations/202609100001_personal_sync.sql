-- DTab personal snapshots. Site settings and published defaults are NOT user rows.
begin;
create table public.dtab_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  last_request_id uuid,
  updated_at timestamptz not null default now()
);
alter table public.dtab_snapshots enable row level security;
revoke all on public.dtab_snapshots from public, anon, authenticated;
grant select on public.dtab_snapshots to authenticated;
create policy dtab_read_own on public.dtab_snapshots for select to authenticated
  using ((select auth.uid()) = user_id);

-- The only client write path. Caller identity is taken from JWT, never a parameter.
create function public.dtab_push_snapshot(p_base_revision bigint, p_request_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  current_row public.dtab_snapshots%rowtype;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_base_revision is null or p_base_revision < 0 or p_request_id is null then
    raise exception 'Invalid revision or request ID' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 2097152 then
    raise exception 'Snapshot must be an object of at most 2 MiB' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each(p_payload) e where e.key not in
    ('home','openType','wallpaperTheme','swiper','clockAndDate','searchBar','searchEngineData','card','appData','bottomArea','simpleMode','dock')
    or jsonb_typeof(e.value) <> 'object') then
    raise exception 'Unsupported snapshot module' using errcode = '22023';
  end if;
  insert into public.dtab_snapshots(user_id) values(caller) on conflict do nothing;
  select * into current_row from public.dtab_snapshots where user_id = caller for update;
  if current_row.last_request_id = p_request_id then
    if current_row.payload <> p_payload then
      raise exception 'Request ID reused with a different payload' using errcode = '22023';
    end if;
    return jsonb_build_object('status','ok','revision',current_row.revision,'payload',current_row.payload);
  end if;
  if current_row.revision <> p_base_revision then
    return jsonb_build_object('status','conflict','revision',current_row.revision,'payload',current_row.payload);
  end if;
  update public.dtab_snapshots set payload=p_payload, revision=revision+1,
    last_request_id=p_request_id, updated_at=clock_timestamp()
    where user_id=caller returning * into current_row;
  return jsonb_build_object('status','ok','revision',current_row.revision,'payload',current_row.payload);
end;
$$;
revoke all on function public.dtab_push_snapshot(bigint,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.dtab_push_snapshot(bigint,uuid,jsonb) to authenticated;
commit;
