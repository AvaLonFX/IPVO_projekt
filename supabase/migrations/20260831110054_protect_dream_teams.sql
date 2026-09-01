-- Preserve legacy records; only active, owned memberships are exposed.
alter table public."UserDreamTeams" add column archived_at timestamptz;
alter table public."UserDreamTeams" add column archive_reason text;
update public."UserDreamTeams" set archived_at = now(), archive_reason = 'legacy_missing_owner_or_player'
where user_id is null or player_id is null;
with duplicates as (
  select id, row_number() over (partition by user_id, player_id order by created_at nulls last, id) as rn
  from public."UserDreamTeams" where archived_at is null
)
update public."UserDreamTeams" d set archived_at = now(), archive_reason = 'legacy_duplicate'
from duplicates x where d.id = x.id and x.rn > 1;
with ranked as (
  select id, row_number() over (partition by user_id order by position nulls last, created_at nulls last, id) as pos
  from public."UserDreamTeams" where archived_at is null
)
update public."UserDreamTeams" d set position = r.pos from ranked r where d.id = r.id;
create unique index dream_team_active_member on public."UserDreamTeams" (user_id, player_id) where archived_at is null;
alter table public."UserDreamTeams" add constraint dream_team_active_valid check
  (archived_at is not null or (user_id is not null and player_id is not null and position > 0));
alter table public."UserDreamTeams" enable row level security;
revoke all on public."UserDreamTeams" from public, anon, authenticated;
grant select, delete on public."UserDreamTeams" to authenticated;
grant insert (user_id, player_id, position) on public."UserDreamTeams" to authenticated;
grant update (position) on public."UserDreamTeams" to authenticated;
create policy dream_team_owner_select on public."UserDreamTeams" for select to authenticated
using ((select auth.uid()) = user_id and archived_at is null);
create policy dream_team_owner_insert on public."UserDreamTeams" for insert to authenticated
with check ((select auth.uid()) = user_id and archived_at is null);
create policy dream_team_owner_update on public."UserDreamTeams" for update to authenticated
using ((select auth.uid()) = user_id and archived_at is null)
with check ((select auth.uid()) = user_id and archived_at is null);
create policy dream_team_owner_delete on public."UserDreamTeams" for delete to authenticated
using ((select auth.uid()) = user_id and archived_at is null);

create schema if not exists qnba_private;
revoke all on schema qnba_private from public, anon, authenticated;
create function qnba_private.guard_dream_team() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid; member_count integer;
begin
  owner_id := case when TG_OP = 'DELETE' then OLD.user_id else NEW.user_id end;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 7391));
  if TG_OP = 'DELETE' then return OLD; end if;
  if TG_OP = 'UPDATE' then
    if NEW.user_id is distinct from OLD.user_id or NEW.player_id is distinct from OLD.player_id then
      raise exception 'Membership identity cannot be changed' using errcode = '23514';
    end if;
  elsif NEW.archived_at is null then
    if owner_id is null or NEW.player_id is null then
      raise exception 'A signed-in owner and player are required' using errcode = '23514';
    end if;
    select count(*), coalesce(max(position), 0) + 1 into member_count, NEW.position
      from public."UserDreamTeams" where user_id = owner_id and archived_at is null;
    if member_count >= 12 then raise exception 'Dream Team is limited to 12 players' using errcode = '23514'; end if;
  end if;
  return NEW;
end;
$$;
revoke all on function qnba_private.guard_dream_team() from public, anon, authenticated;
create trigger dream_team_guard before insert or update or delete on public."UserDreamTeams"
for each row execute function qnba_private.guard_dream_team();

create function public.reorder_dream_team(player_ids integer[]) returns void
language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); existing_ids integer[];
begin
  if owner_id is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if player_ids is null or cardinality(player_ids) > 12 or array_position(player_ids, null) is not null
    or cardinality(player_ids) <> (select count(distinct p) from unnest(player_ids) p) then
    raise exception 'Invalid player order' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 7391));
  select coalesce(array_agg(player_id order by player_id), '{}'::integer[]) into existing_ids
    from public."UserDreamTeams" where user_id = owner_id and archived_at is null;
  if existing_ids is distinct from coalesce((select array_agg(p order by p) from unnest(player_ids) p), '{}'::integer[]) then
    raise exception 'Your team changed. Reload it before reordering.' using errcode = '40001';
  end if;
  update public."UserDreamTeams" d set position = p.ord
    from unnest(player_ids) with ordinality p(id, ord)
    where d.user_id = owner_id and d.player_id = p.id and d.archived_at is null;
end;
$$;
revoke all on function public.reorder_dream_team(integer[]) from public, anon;
grant execute on function public.reorder_dream_team(integer[]) to authenticated;

-- Public popularity contains aggregate counts, never user IDs or team memberships.
create table public.dream_team_popularity (player_id integer primary key, add_count integer not null);
alter table public.dream_team_popularity enable row level security;
revoke all on public.dream_team_popularity from public, anon, authenticated;
grant select on public.dream_team_popularity to anon, authenticated;
create policy popularity_public_read on public.dream_team_popularity for select to anon, authenticated using (true);
insert into public.dream_team_popularity
select player_id, count(distinct user_id)::integer from public."UserDreamTeams"
where archived_at is null group by player_id;
create function qnba_private.refresh_dream_team_popularity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null and coalesce(current_setting('role', true), 'none') not in ('postgres', 'service_role', 'none') then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(7392);
  delete from public.dream_team_popularity;
  insert into public.dream_team_popularity
    select player_id, count(distinct user_id)::integer from public."UserDreamTeams"
    where archived_at is null group by player_id;
  return null;
end;
$$;
revoke all on function qnba_private.refresh_dream_team_popularity() from public, anon, authenticated;
create trigger dream_team_popularity_refresh after insert or update or delete on public."UserDreamTeams"
for each statement execute function qnba_private.refresh_dream_team_popularity();
create or replace function public.get_most_added_players()
returns table(player_id integer, add_count integer)
language sql stable security invoker set search_path = '' as $$
  select player_id, add_count from public.dream_team_popularity order by add_count desc, player_id limit 5;
$$;
grant execute on function public.get_most_added_players() to anon, authenticated;
