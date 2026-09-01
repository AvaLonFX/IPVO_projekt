# Fan features — 2026-08-31

Four additions are implemented locally. Migration 20260831165243_fan_features is applied to the existing Supabase project. Git, deployment, MongoDB and dedicated mobile work remain deferred.

## Lineup duel (/matchups)

Pick five distinct players per side, switch editing sides, remove selections, filter by name/team, or import the first five eligible players in saved Dream Team order. Missing current-stat players are explicitly skipped. Compare summed per-game PTS/REB/AST and shooting percentage weighted by FGA (sum FGM / sum FGA). The comparison identifies the higher value per metric, not a predicted winner. Minutes, defense and chemistry are not simulated. Public share URLs contain only the selected player IDs; no user IDs or saved roster access. Opening a share uses the latest stored stats, not a frozen statistical snapshot.

## Daily Five (/daily-five)

Each UTC day has a frozen 20-player pool sampled across four score tiers from available current stats (PTS >= 5). Five distinct players, budget 80, no position restrictions. Player score is PTS + 1.2 REB + 1.5 AST, rounded to one decimal. Price is round(score / 2), clamped to 8..28. Rules are visible. This is a deterministic lineup puzzle using stored per-game stats, not fantasy scoring from future games. The server validates membership, uniqueness, count, date and budget; it ignores submitted scores or owner IDs. A unique owner/day result prevents resubmitting a different lineup. After submission, the best possible score and one optimal lineup are shown, plus achieved percentage. Reload restores the submitted lineup; unfinished selections are not persisted.

Guests use the existing signed guest cookie; accounts use verified Supabase identity. Guest and account results are separate, as explained on screen. Clearing guest cookies can create a new identity, so this is not suitable for prizes or competitive leaderboards without additional protections.

## Watchlist (/watchlist)

Sign-in required. Search to follow a player, inspect per-game stats and the next stored team game, open the profile, or unfollow. Players with no current stats are shown explicitly, not assigned zero stats or misleading games. Team games do not confirm player availability. The list is private and belongs to the verified account. Repeated follows are idempotent.

## History (/history)

UTC month calendar includes Current/All-Time daily status and attempt counts plus submitted Daily Five scores. Old unfinished Guesser games display as expired. Achievements: first daily win, three-day streak, win without hints, both eras won on the same day, first Daily Five submission. Achievements are derived from server records; no client flags or invented past games. Earlier browser-only Guesser saves are not imported.

## Data and verification

New player_watchlist, daily_five_challenges and daily_five_results tables have RLS and revoked browser grants. Only the trusted server accesses them. Watchlist rows reference Auth users with deletion cascade. Owner/day uniqueness enforces one Daily Five result even with concurrent requests. Normal users cannot query another owner's data through these endpoints.

scripts/check-fan-features.cjs provisions two temporary real accounts and checks private tables, watchlist isolation/idempotency/remove, shared daily pool, duplicate/unknown/over-budget/stale-day rejection, server scores, locked submissions, guest play, history and achievement derivation. It also verifies weighted shooting. Test accounts, sessions and results are cleaned up. TypeScript and production build passed, with existing dependency/middleware/metadata warnings only.

Supabase security advisor reported zero ERRORs; INFO notices for RLS without policies are intentional server-only tables. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy. Existing unrelated security warnings remain unchanged.

Current statistics depend on the existing pipeline and may contain stale season rows; this work does not repair source completeness, image licensing, or provide real-time data. Account deletion tooling should remove owner-keyed game history as well as Auth accounts; watchlist already cascades. Guest-data retention and broader abuse limits remain deployment operations.

Browser verification: selected five Daily Five players for cost 75/80; submitted score 151.0 persisted, with optimum 161.2 and efficiency 93.7%. Calendar showed the score on the correct UTC date and unlocked Team architect. Selected two full comparison lineups; table independently showed A leading in PTS/REB/FG% and B in AST. Share link contained exactly the selected player IDs and no account data. Test Auth accounts were confirmed removed.
