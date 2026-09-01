-- NBA data is public to read; only the trusted server-side pipeline may write it.
do $$
declare table_name text;
begin
  foreach table_name in array array['CurrentStats_NBA', 'Osnovno_NBA', 'GameSchedule', 'GameOdds', 'TeamGameLogs', 'TeamAvailability'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format('grant select on public.%I to anon, authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
    execute format('create policy pipeline_public_read on public.%I for select to anon, authenticated using (true)', table_name);
  end loop;
end;
$$;
