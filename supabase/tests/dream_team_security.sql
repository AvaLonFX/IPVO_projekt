-- Run as the database administrator against a populated development/project database.
-- All changes are rolled back; no user IDs or personal records are returned.
begin;
do $$
declare owner_id uuid; other_id uuid; member integer; candidate integer;
  ids integer[]; expected integer; affected integer; rejected boolean;
begin
  select user_id into owner_id from public."UserDreamTeams"
    where archived_at is null group by user_id having count(*) between 1 and 11 limit 1;
  select user_id into other_id from public."UserDreamTeams"
    where archived_at is null and user_id <> owner_id limit 1;
  if owner_id is null or other_id is null then raise exception 'Tests require two existing owners'; end if;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  set local role authenticated;
  if exists(select 1 from public."UserDreamTeams" where user_id <> owner_id or archived_at is not null)
    then raise exception 'Owner isolation failed'; end if;
  select player_id into member from public."UserDreamTeams" limit 1;
  rejected := false;
  begin insert into public."UserDreamTeams"(user_id,player_id) values(other_id,member);
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Owner spoof accepted'; end if;
  rejected := false;
  begin insert into public."UserDreamTeams"(user_id,player_id) values(owner_id,member);
  exception when unique_violation then rejected := true; end;
  if not rejected then raise exception 'Duplicate accepted'; end if;
  rejected := false;
  begin update public."UserDreamTeams" set position=null where player_id=member;
  exception when check_violation then rejected := true; end;
  if not rejected then raise exception 'Null position accepted'; end if;
  update public."UserDreamTeams" set position=99 where user_id=other_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Foreign update accepted'; end if;
  delete from public."UserDreamTeams" where user_id=other_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Foreign delete accepted'; end if;
  select array_agg(player_id order by position desc) into ids from public."UserDreamTeams";
  perform public.reorder_dream_team(ids);
  if ids is distinct from (select array_agg(player_id order by position) from public."UserDreamTeams")
    then raise exception 'Reorder did not persist'; end if;
  rejected := false;
  begin perform public.reorder_dream_team(array[0]);
  exception when serialization_failure then rejected := true; end;
  if not rejected then raise exception 'Stale reorder accepted'; end if;
  select count(*) into expected from public."UserDreamTeams";
  for candidate in select "PERSON_ID" from public."FullStats_NBA"
    where "PERSON_ID" not in(select player_id from public."UserDreamTeams") limit 13
  loop
    exit when expected = 12;
    insert into public."UserDreamTeams"(user_id,player_id) values(owner_id,candidate);
    expected := expected + 1;
  end loop;
  if (select count(*) from public."UserDreamTeams") <> 12 then raise exception 'Fill to 12 failed'; end if;
  select "PERSON_ID" into candidate from public."FullStats_NBA"
    where "PERSON_ID" not in(select player_id from public."UserDreamTeams") limit 1;
  rejected := false;
  begin insert into public."UserDreamTeams"(user_id,player_id) values(owner_id,candidate);
  exception when check_violation then rejected := true; end;
  if not rejected then raise exception '13th member accepted'; end if;
  delete from public."UserDreamTeams" where player_id=member;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Own delete failed'; end if;
  set local role anon;
  rejected := false;
  begin perform 1 from public."UserDreamTeams";
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Anonymous private read accepted'; end if;
  perform * from public.get_most_added_players();
  rejected := false;
  begin delete from public."GameSchedule" where false;
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Anonymous pipeline write allowed'; end if;
  reset role;
end;
$$;
rollback;
select 'All dream-team isolation, mutation, limit, reorder and pipeline-access checks passed (rolled back).' as result;
