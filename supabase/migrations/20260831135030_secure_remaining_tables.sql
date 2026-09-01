-- Explicitly audited tables only. Preserve all existing policies, data and default privileges.
alter table public."Active_Players_HOF_Predictions" enable row level security;
revoke all on public."Active_Players_HOF_Predictions" from public,anon,authenticated;
grant select on public."Active_Players_HOF_Predictions" to anon,authenticated;
create policy audited_content_read on public."Active_Players_HOF_Predictions" for select to anon,authenticated using(true);
alter table public."FullStats_NBA" enable row level security;
revoke all on public."FullStats_NBA" from public,anon,authenticated;
grant select on public."FullStats_NBA" to anon,authenticated;
create policy audited_content_read on public."FullStats_NBA" for select to anon,authenticated using(true);
alter table public."Teams" enable row level security;
revoke all on public."Teams" from public,anon,authenticated;
grant select on public."Teams" to anon,authenticated;
create policy audited_content_read on public."Teams" for select to anon,authenticated using(true);
alter table public."Heatmap" enable row level security;
revoke all on public."Heatmap" from public,anon,authenticated;
grant select on public."Heatmap" to anon,authenticated;
create policy audited_content_read on public."Heatmap" for select to anon,authenticated using(true);
alter table public."searchstats" enable row level security;
revoke all on public."searchstats" from public,anon,authenticated;
grant select on public."searchstats" to anon,authenticated;
create policy audited_content_read on public."searchstats" for select to anon,authenticated using(true);
alter table public."yt_daily_videos" enable row level security;
revoke all on public."yt_daily_videos" from public,anon,authenticated;
grant select on public."yt_daily_videos" to anon,authenticated;
create policy audited_content_read on public."yt_daily_videos" for select to anon,authenticated using(true);
alter table public."yt_video_clips" enable row level security;
revoke all on public."yt_video_clips" from public,anon,authenticated;
grant select on public."yt_video_clips" to anon,authenticated;
create policy audited_content_read on public."yt_video_clips" for select to anon,authenticated using(true);
alter table public."player_highlights" enable row level security;
revoke all on public."player_highlights" from public,anon,authenticated;
grant select on public."player_highlights" to anon,authenticated;
create policy audited_content_read on public."player_highlights" for select to anon,authenticated using(true);
alter table public."CurrentStats_NBA_backup" enable row level security;
revoke all on public."CurrentStats_NBA_backup" from public,anon,authenticated;
create policy audited_service_only on public."CurrentStats_NBA_backup" to service_role using(true) with check(true);
alter table public."HOP_Training_Dataset" enable row level security;
revoke all on public."HOP_Training_Dataset" from public,anon,authenticated;
create policy audited_service_only on public."HOP_Training_Dataset" to service_role using(true) with check(true);
alter table public."HOP_Training_Dataset_backup" enable row level security;
revoke all on public."HOP_Training_Dataset_backup" from public,anon,authenticated;
create policy audited_service_only on public."HOP_Training_Dataset_backup" to service_role using(true) with check(true);
alter table public."Osnovno_NBA_backup" enable row level security;
revoke all on public."Osnovno_NBA_backup" from public,anon,authenticated;
create policy audited_service_only on public."Osnovno_NBA_backup" to service_role using(true) with check(true);
alter table public."nbatest" enable row level security;
revoke all on public."nbatest" from public,anon,authenticated;
create policy audited_service_only on public."nbatest" to service_role using(true) with check(true);
alter table public."Osnovno_NBA_duplicate2526" enable row level security;
revoke all on public."Osnovno_NBA_duplicate2526" from public,anon,authenticated;
create policy audited_service_only on public."Osnovno_NBA_duplicate2526" to service_role using(true) with check(true);
alter table public."CurrentStats_NBA_duplicate2526" enable row level security;
revoke all on public."CurrentStats_NBA_duplicate2526" from public,anon,authenticated;
create policy audited_service_only on public."CurrentStats_NBA_duplicate2526" to service_role using(true) with check(true);
alter table public."TrainingDataset" enable row level security;
revoke all on public."TrainingDataset" from public,anon,authenticated;
create policy audited_service_only on public."TrainingDataset" to service_role using(true) with check(true);
alter table public."ModelRuns" enable row level security;
revoke all on public."ModelRuns" from public,anon,authenticated;
create policy audited_service_only on public."ModelRuns" to service_role using(true) with check(true);
alter table public."TrainingDataset_v2" enable row level security;
revoke all on public."TrainingDataset_v2" from public,anon,authenticated;
create policy audited_service_only on public."TrainingDataset_v2" to service_role using(true) with check(true);
alter table public."TrainingDataset_v3" enable row level security;
revoke all on public."TrainingDataset_v3" from public,anon,authenticated;
create policy audited_service_only on public."TrainingDataset_v3" to service_role using(true) with check(true);
alter table public."user_interactions" enable row level security;
revoke all on public."user_interactions" from public,anon,authenticated;
grant select on public.user_interactions to authenticated;
grant insert(user_id,item_type,item_id,event_type,weight) on public.user_interactions to authenticated;
grant usage on sequence public.user_interactions_id_seq to authenticated;
create policy interaction_owner_read on public.user_interactions for select to authenticated using(user_id=(select auth.uid()));
create policy interaction_owner_insert on public.user_interactions for insert to authenticated
with check(user_id=(select auth.uid()) and item_type='player' and item_id ~ '^[0-9]{1,10}$'
and event_type in ('search_click','view_player','compare_click') and weight between 1 and 5
and exists(select 1 from public."Osnovno_NBA" p where p."PERSON_ID"::text=item_id));
create index if not exists interaction_owner_created on public.user_interactions(user_id,created_at desc);
alter function public.update_searchstats_timestamp() set search_path='';
revoke all on function public.update_searchstats_timestamp() from public,anon,authenticated;

create table qnba_private.search_cooldowns(
 user_id uuid not null references auth.users(id) on delete cascade,
 player_id integer not null,
 counted_at timestamptz not null default now(),
 primary key(user_id,player_id)
);
alter table qnba_private.search_cooldowns enable row level security;
revoke all on qnba_private.search_cooldowns from public,anon,authenticated;
grant all on qnba_private.search_cooldowns to service_role;
create policy service_only on qnba_private.search_cooldowns to service_role using(true) with check(true);
create function qnba_private.count_search(player integer) returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); touched integer;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if not exists(select 1 from public."Osnovno_NBA" where "PERSON_ID"=player) then raise exception 'Unknown player' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,7400));
 if (select count(*) from qnba_private.search_cooldowns where user_id=owner_id and counted_at>now()-interval '1 minute') >=30 then return; end if;
 insert into qnba_private.search_cooldowns(user_id,player_id) values(owner_id,player)
 on conflict(user_id,player_id) do update set counted_at=now() where search_cooldowns.counted_at < now()-interval '1 minute';
 get diagnostics touched=row_count;
 if touched>0 then
 insert into public.searchstats(player_id,search_count) values(player,1)
 on conflict(player_id) do update set search_count=searchstats.search_count+1;
 end if;
end; $$;
create or replace function public.increment_search_count(player_id_param integer) returns void
language sql security invoker set search_path='' as $$select qnba_private.count_search(player_id_param);$$;
revoke all on function qnba_private.count_search(integer),public.increment_search_count(integer) from public,anon,authenticated;
grant usage on schema qnba_private to authenticated;
grant execute on function qnba_private.count_search(integer),public.increment_search_count(integer) to authenticated;

create function qnba_private.retention_counts(days_back integer) returns table(new_users integer,day1_users integer,day7_users integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if days_back is null or days_back not between 1 and 90 then raise exception 'Invalid date range' using errcode='22023'; end if;
 return query
 with first_seen as (select user_id,date_trunc('day',min(created_at)) day0 from public.user_interactions where user_id is not null group by user_id),
 activity_days as (select distinct user_id,date_trunc('day',created_at) as activity_day from public.user_interactions),
 cohort as (select * from first_seen where day0>=date_trunc('day',now()-make_interval(days=>days_back)))
 select count(*)::int,
 count(*) filter(where exists(select 1 from activity_days a where a.user_id=c.user_id and a.activity_day=c.day0+interval '1 day'))::int,
 count(*) filter(where exists(select 1 from activity_days a where a.user_id=c.user_id and a.activity_day=c.day0+interval '7 days'))::int from cohort c;
end; $$;
create or replace function public.retention_summary(days_back integer default 30) returns table(new_users integer,day1_users integer,day7_users integer)
language sql stable security invoker set search_path='' as $$select * from qnba_private.retention_counts(days_back);$$;
create function qnba_private.funnel_counts() returns table(searched integer,viewed integer,compared integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return query with actions as (
 select user_id,bool_or(event_type='search_click') s,bool_or(event_type='view_player') v,bool_or(event_type='compare_click') c
 from public.user_interactions where user_id is not null group by user_id)
 select count(*) filter(where s)::int,count(*) filter(where s and v)::int,count(*) filter(where s and v and c)::int from actions;
end; $$;
create function public.funnel_summary() returns table(searched integer,viewed integer,compared integer)
language sql stable security invoker set search_path='' as $$select * from qnba_private.funnel_counts();$$;
revoke all on function qnba_private.retention_counts(integer),public.retention_summary(integer),qnba_private.funnel_counts(),public.funnel_summary() from public,anon,authenticated;
grant execute on function qnba_private.retention_counts(integer),public.retention_summary(integer),qnba_private.funnel_counts(),public.funnel_summary() to authenticated;
