create table public.nba_current_snapshot (
 player_id bigint primary key check(player_id>0),
 season text not null,
 synced_at timestamptz not null,
 payload jsonb not null
);
alter table public.nba_current_snapshot enable row level security;
revoke all on public.nba_current_snapshot from public,anon,authenticated;
grant select on public.nba_current_snapshot to anon,authenticated;
grant all on public.nba_current_snapshot to service_role;
create policy "Public verified NBA statistics" on public.nba_current_snapshot for select to anon,authenticated using(true);
create function public.publish_nba_snapshot(p_rows jsonb,p_season text) returns integer
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_season !~ '^20[0-9]{2}-[0-9]{2}$' or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<100 then raise exception 'Invalid NBA snapshot';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) p where (p->>'PLAYER_ID') is null or (p->>'GP') is null or (p->>'PTS') is null or (p->>'REB') is null or (p->>'AST') is null) then raise exception 'Incomplete NBA snapshot';end if;
 perform pg_advisory_xact_lock(741299);
 delete from public.nba_current_snapshot where player_id>0;
 insert into public.nba_current_snapshot(player_id,season,synced_at,payload)
 select (p->>'PLAYER_ID')::bigint,p_season,now(),p from jsonb_array_elements(p_rows) p;
 get diagnostics n=row_count;
 return n;
end $$;
revoke all on function public.publish_nba_snapshot(jsonb,text) from public,anon,authenticated;
grant execute on function public.publish_nba_snapshot(jsonb,text) to service_role;
create view public.verified_current_stats with(security_invoker=true) as
select player_id as "PLAYER_ID",payload->>'PLAYER_NAME' as "PLAYER_NAME",payload->>'TEAM_ABBREVIATION' as "TEAM_ABBREVIATION",
 (payload->>'TEAM_ID')::bigint as "TEAM_ID",season,synced_at,
 (payload->>'PTS')::double precision as "PTS",(payload->>'REB')::double precision as "REB",(payload->>'AST')::double precision as "AST",
 (payload->>'STL')::double precision as "STL",(payload->>'BLK')::double precision as "BLK",(payload->>'GP')::double precision as "GP",
 (payload->>'FGM')::double precision as "FGM",(payload->>'FGA')::double precision as "FGA",(payload->>'FG_PCT')::double precision as "FG_PCT",
 (payload->>'FG3M')::double precision as "FG3M",(payload->>'FG3A')::double precision as "FG3A",(payload->>'FTM')::double precision as "FTM",
 (payload->>'FT_PCT')::double precision as "FT_PCT" from public.nba_current_snapshot;
revoke all on public.verified_current_stats from public,anon,authenticated;
grant select on public.verified_current_stats to anon,authenticated,service_role;
