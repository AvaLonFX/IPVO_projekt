alter table public.match_challenges drop constraint if exists match_challenges_status_check;
alter table public.match_challenges add constraint match_challenges_status_check check (status in ('open','coaching','playing_first_half','halftime','playing_second_half','completed'));
alter table public.match_challenges drop constraint if exists match_challenges_state_check;
alter table public.match_challenges add constraint match_challenges_state_check check (
  (status = 'open' and result_id is null and opponent_setup is null and completed_at is null) or
  (status in ('coaching','playing_first_half','halftime','playing_second_half') and result_id is null and opponent_setup is not null and completed_at is null) or
  (status = 'completed' and result_id is not null and opponent_setup is not null and completed_at is not null)
);
alter table public.match_challenges
  add column if not exists current_game jsonb,
  add column if not exists game_started_at timestamptz,
  add column if not exists halftime_started_at timestamptz,
  add column if not exists creator_halftime_ready boolean not null default false,
  add column if not exists opponent_halftime_ready boolean not null default false;
