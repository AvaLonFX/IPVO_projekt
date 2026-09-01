create index if not exists match_challenges_result_idx
  on public.match_challenges (result_id)
  where result_id is not null;

create policy "match_results_server_only"
  on public.match_results for all
  using (false) with check (false);
create policy "match_challenges_server_only"
  on public.match_challenges for all
  using (false) with check (false);
