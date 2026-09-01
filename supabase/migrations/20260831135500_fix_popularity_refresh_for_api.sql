create or replace function qnba_private.refresh_dream_team_popularity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null and coalesce(current_setting('role',true),'none') not in ('postgres','service_role','none') then
 raise exception 'Sign in required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(7392);
 insert into public.dream_team_popularity(player_id,add_count)
 select player_id,count(distinct user_id)::integer from public."UserDreamTeams" where archived_at is null group by player_id
 on conflict(player_id) do update set add_count=excluded.add_count;
 delete from public.dream_team_popularity p where not exists
 (select 1 from public."UserDreamTeams" d where d.player_id=p.player_id and d.archived_at is null);
 return null;
end; $$;
revoke all on function qnba_private.refresh_dream_team_popularity() from public,anon,authenticated;
