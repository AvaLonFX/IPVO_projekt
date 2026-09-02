alter table public.match_challenges
  add column if not exists era text not null default 'current';

alter table public.match_challenges
  drop constraint if exists match_challenges_era_check;

alter table public.match_challenges
  add constraint match_challenges_era_check check (era in ('current', 'alltime'));

comment on column public.match_challenges.era is
  'Player dataset used by every synchronized game in the challenge series.';
