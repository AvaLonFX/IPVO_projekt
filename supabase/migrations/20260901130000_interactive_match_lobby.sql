alter table public.match_challenges drop constraint if exists match_challenges_check;
alter table public.match_challenges drop constraint if exists match_challenges_status_check;

alter table public.match_challenges
  add column if not exists mode text not null default 'classic',
  add column if not exists wins integer[] not null default array[0, 0],
  add column if not exists games jsonb not null default '[]'::jsonb,
  add column if not exists creator_ready boolean not null default false,
  add column if not exists opponent_ready boolean not null default false,
  add column if not exists version integer not null default 0;

alter table public.match_challenges
  add constraint match_challenges_mode_check
    check (mode in ('classic', 'salary', 'draft')),
  add constraint match_challenges_wins_check
    check (cardinality(wins) = 2 and wins[1] >= 0 and wins[2] >= 0),
  add constraint match_challenges_games_check
    check (jsonb_typeof(games) = 'array' and jsonb_array_length(games) <= 13),
  add constraint match_challenges_status_check
    check (status in ('open', 'coaching', 'completed')),
  add constraint match_challenges_state_check
    check (
      (status = 'open' and result_id is null and opponent_setup is null and completed_at is null)
      or
      (status = 'coaching' and result_id is null and opponent_setup is not null and completed_at is null)
      or
      (status = 'completed' and result_id is not null and opponent_setup is not null and completed_at is not null)
    );

update public.match_challenges challenge
set
  wins = case
    when result.payload ? 'series' then
      array[(result.payload->'series'->'wins'->>0)::integer, (result.payload->'series'->'wins'->>1)::integer]
    when (result.score)[1] > (result.score)[2] then array[1, 0]
    else array[0, 1]
  end,
  games = case
    when result.payload ? 'series' then result.payload->'series'->'games'
    else jsonb_build_array(result.payload->'result')
  end,
  creator_ready = true,
  opponent_ready = true
from public.match_results result
where challenge.result_id = result.id and challenge.status = 'completed';

comment on column public.match_challenges.games is
  'Completed games in an interactive series; tactics and minutes may change between games.';
