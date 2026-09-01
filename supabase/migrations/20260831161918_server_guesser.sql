-- Answers and sessions are server-only. No browser role may read or mutate them.
create table public.guesser_challenges (
  id uuid primary key default gen_random_uuid(),
  era text not null check (era in ('current','alltime')),
  day date not null,
  answer jsonb not null,
  unique(era,day)
);
create table public.guesser_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  era text not null check (era in ('current','alltime')),
  mode text not null check (mode in ('daily','practice')),
  day date not null,
  answer jsonb not null,
  moves jsonb not null default '[]'::jsonb check (jsonb_typeof(moves) = 'array' and jsonb_array_length(moves) <= 6),
  status text not null default 'playing' check (status in ('playing','won','lost')),
  version integer not null default 0 check (version between 0 and 6),
  created_at timestamptz not null default now()
);
create unique index guesser_daily_owner on public.guesser_sessions(owner_key,era,day) where mode='daily';
create index guesser_owner_history on public.guesser_sessions(owner_key,mode,era,day desc);
create index guesser_owner_created on public.guesser_sessions(owner_key,created_at desc);
alter table public.guesser_challenges enable row level security;
alter table public.guesser_sessions enable row level security;
revoke all on public.guesser_challenges, public.guesser_sessions from public, anon, authenticated;
grant select,insert,update,delete on public.guesser_challenges, public.guesser_sessions to service_role;

-- Invoker RPC, executable only by the trusted app server. Serializes starts and
-- limits practice creation even if requests arrive at multiple server instances.
create function public.start_guesser(p_owner text,p_era text,p_mode text,p_answer jsonb,p_new boolean default false)
returns public.guesser_sessions language plpgsql security invoker set search_path='' as $$
declare s public.guesser_sessions; d date := (now() at time zone 'UTC')::date; a jsonb;
begin
  if p_owner is null or length(p_owner)>100 or p_era not in ('current','alltime') or p_mode not in ('daily','practice') then
    raise exception 'Invalid game';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner,7410));
  if p_mode='daily' then
    select * into s from public.guesser_sessions where owner_key=p_owner and era=p_era and mode=p_mode and day=d;
    if found then return s; end if;
    insert into public.guesser_challenges(era,day,answer) values(p_era,d,p_answer) on conflict(era,day) do nothing;
    select answer into a from public.guesser_challenges where era=p_era and day=d;
  else
    select * into s from public.guesser_sessions where owner_key=p_owner and era=p_era and mode=p_mode order by created_at desc limit 1;
    if found and (not p_new or s.status='playing') then return s; end if;
    if (select count(*) from public.guesser_sessions where owner_key=p_owner and created_at>now()-interval '1 hour') >= 30 then
      raise exception 'Practice limit reached' using errcode='P0001';
    end if;
    a:=p_answer;
  end if;
  insert into public.guesser_sessions(owner_key,era,mode,day,answer) values(p_owner,p_era,p_mode,d,a) returning * into s;
  return s;
end $$;
revoke all on function public.start_guesser(text,text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.start_guesser(text,text,text,jsonb,boolean) to service_role;
