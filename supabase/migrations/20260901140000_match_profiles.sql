create table if not exists public.match_profiles (
  owner_key text primary key,
  public_slug text not null unique default replace(gen_random_uuid()::text, '-', ''),
  display_name text not null default 'Arena Coach' check (char_length(display_name) between 2 and 32),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.match_profiles enable row level security;
revoke all on public.match_profiles from anon, authenticated;
create policy "server only match profiles" on public.match_profiles for all to anon, authenticated using (false) with check (false);

