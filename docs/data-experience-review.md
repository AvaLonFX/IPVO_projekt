# Data and experience review — 2026-08-31

## Findings and corrections

- CurrentStats_NBA contained 687 unique player IDs; the fresh configured 2025-26 regular-season NBA import contained 582. The old table mixed residual rows with newly imported rows. No original rows were deleted.
- Published 582 rows atomically into nba_current_snapshot, exposed through security-invoker verified_current_stats. The public view includes numeric statistical columns, season and synced_at. Current player exploration, current Guesser selection, lineup duels, new Daily Five pools, watchlist stats and profile season cards now use this source.
- Snapshot timestamp on the verified import: 2026-08-31 17:09:34 UTC. Pipeline is configured for 2025-26 stats and 2026-27 schedule; the next season must be enabled when its data exists. This is stored data, not a live feed.
- The laptop player pipeline now validates essential numeric data and publishes the entire snapshot in one transaction after successful source fetches and biography updates. Invalid/empty/duplicate snapshot publication rolls back. Old verified data remains available if publication fails. Existing legacy upserts are retained for downstream compatibility.
- No duplicate IDs were found in current, biography or historical totals tables. 237 biographies lack historical totals; one historical total lacks a biography. Profiles no longer wait indefinitely for missing historical totals, and Guesser skips missing biographies when sampling.
- Before refresh, 20 current/bio team differences existed. After the verified import, season vs biography team differences were zero. UI labels still distinguish season-statistics team from latest stored roster team because trades can legitimately make these differ later.
- Osnovno_NBA contains mixed STATS_TIMEFRAME values (Season and Career). Profile and comparison charts previously mixed those values with FullStats_NBA archived totals. Historical per-game values now come from the same archived totals / GP. New All-Time Guesser selections use the same basis, sampled across the full paginated archive. Existing daily challenge snapshots/results remain unchanged.
- FullStats_NBA provenance, coverage and last update remain unverified. It is labeled an original-project historical archive, never presented as current career totals. Hall of Fame output is explicitly an experimental model, not an official prediction. A verified career-history rebuild is separate work; no missing historical values were invented.

## Interface

Navigation groups Explore, Games and My players & teams, highlights the active page and removes Analytics/Funnel from the ordinary menu. Their routes were not deleted or newly role-restricted; hiding links is not authorization.

Home retains the existing visual structure. Daily Guesser cards resume ongoing challenges; Daily Five shows the saved score or a link to build. Highlight of the day became Latest highlight because the latest saved clip was from March, not today. The empty highlight message no longer contains database setup instructions. The old Analytics feature card now links to the private watchlist.

Player profiles have one action group for follow/unfollow, comparison and Dream Team, followed by a verified season card with source, timestamp and numeric stats. Existing biographies, player images and reactions remain. MongoDB was not repaired or changed. Missing historical stats no longer block the profile. Invalid/missing player and team links have clear errors and retry/search navigation. Draft values such as 2003.0 display as 2003.

Season exploration sorts numeric stats correctly, labels FG/FT percentages on a 0–100 scale, shows games played rather than an unverified stale Player_Rating, resets pagination on filter changes, rejects stale responses and distinguishes loading, error and empty states. Historical exploration is explicitly labeled and has equivalent loading/error handling. Search offers keyboard selection, clears a selection cleanly and distinguishes unavailable search from no matches.

Sign-in failures now show a visible generic message and preserve the return destination. Login, password-reset callbacks and OAuth callback destinations are restricted to local paths. Submission buttons prevent repeat clicks while pending. OAuth callback failures return a useful error instead of silently returning to the app.

## Verification

- Fresh laptop player pipeline ran successfully and published exactly 582 verified rows without deleting the 687 legacy rows.
- scripts/check-data-quality.cjs: uniqueness, season/timestamp metadata, numeric AST ordering, anonymous write/RPC denial, failed empty/duplicate import rollback, safe redirects.
- Existing Guesser and fan-feature suites passed with two real accounts, owner isolation, game concurrency, daily scoring and result persistence; their test accounts were removed.
- Offline pipeline tests: four passed.
- Production build and TypeScript passed (existing font/dependency/middleware/metadata warnings remain).
- Browser: verified LeBron season card matched the snapshot; Marcus Mann (no historical totals) rendered a complete biography with explicit missing-data messages. Grouped navigation rendered on a fresh page. Wrong-password sign-in showed a message; successful sign-in returned to /player/2544. Profile follow and Dream Team actions were exercised with a temporary account.
- Profile actions confirmed “Unfollow player” and disabled “In your Dream Team” after successful saves. The journey account was signed out, sessions revoked, its records deleted and credentials file removed. Database check confirmed zero remaining journey accounts and the original 50 Dream Team rows preserved.
- Email delivery/confirmation and external Google consent were not exercised; the journey account was provisioned directly as a confirmed test account to avoid sending external mail.
- Supabase advisor: zero ERRORs. Intentional public NBA snapshot/view visibility produces GraphQL discovery notices: https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed. No private user data was made public.

Git/push, deployment, MongoDB repairs, image licensing and dedicated mobile redesign remain deferred. Live Vercel still needs the later planned publication to receive these local code changes.
