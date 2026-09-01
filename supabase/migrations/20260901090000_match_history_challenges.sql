create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null check (owner_key ~ '^(user|guest):'),
  source text not null default 'simulation' check (source in ('simulation', 'challenge')),
  title text not null default 'QNBA match' check (char_length(title) between 1 and 80),
  score integer[] not null check (cardinality(score) = 2 and score[1] >= 0 and score[2] >= 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists match_results_owner_created_idx
  on public.match_results (owner_key, created_at desc);

create table if not exists public.match_challenges (
  id uuid primary key default gen_random_uuid(),
  share_code text not null unique default encode(gen_random_bytes(18), 'hex')
    check (share_code ~ '^[0-9a-f]{36}$'),
  creator_key text not null check (creator_key ~ '^(user|guest):'),
  creator_setup jsonb not null check (jsonb_typeof(creator_setup) = 'object'),
  opponent_key text check (opponent_key is null or opponent_key ~ '^(user|guest):'),
  opponent_setup jsonb check (opponent_setup is null or jsonb_typeof(opponent_setup) = 'object'),
  result_id uuid references public.match_results(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (
    (status = 'open' and result_id is null and opponent_setup is null and completed_at is null)
    or
    (status = 'completed' and result_id is not null and opponent_setup is not null and completed_at is not null)
  )
);

create index if not exists match_challenges_creator_created_idx
  on public.match_challenges (creator_key, created_at desc);
create index if not exists match_challenges_opponent_created_idx
  on public.match_challenges (opponent_key, created_at desc)
  where opponent_key is not null;

alter table public.match_results enable row level security;
alter table public.match_challenges enable row level security;

revoke all on public.match_results from anon, authenticated;
revoke all on public.match_challenges from anon, authenticated;

comment on table public.match_results is
  'Server-owned saved QNBA simulations. Access is exposed only through authenticated or signed guest API identity checks.';
comment on table public.match_challenges is
  'Server-owned one-use QNBA match challenges addressed by high-entropy share codes.';
