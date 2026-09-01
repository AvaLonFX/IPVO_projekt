alter table public.match_challenges
  add column if not exists best_of integer not null default 1
  check (best_of in (1, 3, 5, 7));

comment on column public.match_challenges.best_of is
  'Odd series length. First side to floor(best_of / 2) + 1 wins completes the challenge.';
