create table public.player_watchlist (
 user_id uuid not null references auth.users(id) on delete cascade,
 player_id bigint not null,
 created_at timestamptz not null default now(),
 primary key(user_id,player_id)
);
create table public.daily_five_challenges (
 day date primary key,
 pool jsonb not null,
 budget integer not null default 80 check(budget=80)
);
create table public.daily_five_results (
 owner_key text not null,
 day date not null references public.daily_five_challenges(day),
 player_ids bigint[] not null check(cardinality(player_ids)=5),
 score numeric not null,
 created_at timestamptz not null default now(),
 primary key(owner_key,day)
);
alter table public.player_watchlist enable row level security;
alter table public.daily_five_challenges enable row level security;
alter table public.daily_five_results enable row level security;
revoke all on public.player_watchlist,public.daily_five_challenges,public.daily_five_results from public,anon,authenticated;
grant select,insert,update,delete on public.player_watchlist,public.daily_five_challenges,public.daily_five_results to service_role;
