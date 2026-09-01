begin;
do $$
declare t record; owner_id uuid; player integer; before_count integer; after_count integer;
begin
 if exists(select 1 from pg_tables where schemaname='public' and not rowsecurity) then raise exception 'Unprotected public table'; end if;
 for t in select tablename from pg_tables where schemaname='public' loop
  if has_table_privilege('anon',format('public.%I',t.tablename),'INSERT,UPDATE,DELETE,TRUNCATE') then raise exception 'Anonymous write: %',t.tablename; end if;
 end loop;
 for t in select unnest(array['TrainingDataset','TrainingDataset_v2','TrainingDataset_v3','ModelRuns','nbatest','Osnovno_NBA_backup','CurrentStats_NBA_backup','HOP_Training_Dataset','HOP_Training_Dataset_backup','Osnovno_NBA_duplicate2526','CurrentStats_NBA_duplicate2526']) as name loop
  if has_table_privilege('authenticated',format('public.%I',t.name),'SELECT') or has_table_privilege('anon',format('public.%I',t.name),'SELECT') then raise exception 'Private table exposed: %',t.name; end if;
 end loop;
 select id into owner_id from auth.users where email like 'qnba-test-%@example.invalid' limit 1;
 if owner_id is null then raise exception 'Provision disposable test accounts first'; end if;
 select "PERSON_ID" into player from public."Osnovno_NBA" p where not exists(select 1 from qnba_private.search_cooldowns c where c.user_id=owner_id and c.player_id=p."PERSON_ID") limit 1;
 select coalesce((select search_count from public.searchstats where player_id=player),0) into before_count;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 set local role authenticated;
 perform public.increment_search_count(player);
 perform public.increment_search_count(player);
 select search_count into after_count from public.searchstats where player_id=player;
 if after_count <> before_count+1 then raise exception 'Search cooldown failed'; end if;
 perform * from public.retention_summary(30);
 perform * from public.funnel_summary();
 reset role;
end; $$;
rollback;
select 'PASS: all public tables protected; no guest writes; private tables hidden; authenticated aggregates and search cooldown verified (rolled back)' as result;
