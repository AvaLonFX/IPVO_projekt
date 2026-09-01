# Match simulator v3

Local preview: `/matchups`. No schema changes, database writes, deployment or Git operations. Existing Dream Teams and Daily Five history are unchanged.

## Setup

Each side has five starters and zero to three bench players. The first five must cover G/G/F/F/C. A backtracking assignment handles G-F and F-C without counting the same player twice. Client disables tip-off for invalid selections; server independently validates actual stored positions. Demo selection produces two disjoint eight-player rotations. Dream Team import retains saved order and reports skipped ineligible players; an imported composition may need manual editing to become legal. Same player on opposing sides remains allowed for sandbox comparisons.

Users can edit every player's workload from 0 to 48 minutes. The client shows unusual starter/bench workloads and requires exactly 240 minutes; the server independently checks player count, matching minute-array length, finite 0–48 values and the 240 total. Zero-minute players have zero event weight. Auto allocation restores a season-MPG-based rotation.

Roster eligibility requires known position and finite complete season shooting, minute, game-count, passing and rebounding inputs. Positions are current biography labels, not historical season matchup tracking. Missing inputs are excluded rather than quietly filled with zero.

## Model

- Four 12-minute periods; tied games have up to six 5-minute overtime periods, then a draw if necessary. Season MPG is bounded separately for starters and bench, then normalized to exactly 240 team minutes. This is possession-share weighting rather than an on-court substitution or fatigue engine.
- Continuous decreasing game clock. Possession duration is a model assumption: balanced/pressure/perimeter approximately 10–16 seconds, fast 8–14, inside 12–18; second chances use 4–13 seconds. There are no invented fixed extra points or guaranteed outcomes.
- Usage: smoothed FGA + 0.44 FTA per 36 minutes, weighted by allocated rotation minutes, distributes shot opportunities. Inside tactic multiplies the assigned center's usage by 1.6.
- Per-minute rates use 400 pseudo-minutes of prior data. Shooting uses approximate season attempts (per-game attempts × GP), with priors of 150 two-point attempts at 53%, 200 threes at 35%, and 75 free throws at 77%. Source per-game rounding means these are approximate totals. Priors are explicit design assumptions, not fitted NBA coefficients.
- Under 400 observed minutes is labeled limited sample; under 1,200 moderate; otherwise established. This is a sample indicator, not a probability confidence interval.
- Turnovers depend on the chosen handler's turnover/usage/passing rates. Opposing steals and pressure alter turnover probability. Recorded steals are a subset of turnovers. They terminate possession.
- Assigned positional defenders can block shots. Blocked attempts count as field-goal misses and lead to a rebound contest. No separate score bonus is awarded for defense.
- Offensive rebound chance compares the lineup's OREB and opposing DREB rates. Offensive rebounds retain possession, consume remaining clock and allow second-chance points. Defensive rebounds end the possession. A missed last free throw also triggers a rebound. At the horn rebounds may be credited but do not generate another shot.
- Lineups with established shooting volume (at least 2 smoothed threes attempted per 36, posterior accuracy at least 33%) modify two-point spacing within a small bounded range. No generic chemistry rating.
- Perimeter shifts three-point frequency +18 percentage points and reduces foul trips. Inside shifts it −18, emphasizes the center, increases foul chances and lengthens possessions. Fast reduces time but adds turnover risk. Pressure increases opposing turnovers and opposing shooting-foul probability. Effects are bounded and described in the UI.

No literal substitutions, fatigue, home advantage, injuries, foul-outs, and-ones, defensive tracking or deliberate endgame fouling. This remains an entertainment simulation, not a forecast of real NBA games.

The result is compared with an audited 2024-25 NBA regular-season reference filtered to NBA teams: 1,230 games, 227.65 average combined points, 19.79 standard deviation, 12.75 average margin, and a 195–261 central 90% total-points interval. The database has team game logs but no historical player lineups or player minutes by game, so this is league-level scoring calibration only. It must not be described as matchup-level validation.

## Interface and playback

Roster portraits and role assignments, sample-size warnings, five tactics with tradeoffs, scoreboard, scoring leaders, scoring runs, lead graph, play-by-play, period totals, allocated minutes, extended box scores (OREB/STL/BLK), league scoring reference, and factual end-of-game comparisons. Scoring leaders and graph use only revealed play snapshots, not final statistics.

Playback pauses after Q2. The user can set a second-half tactic for both teams. The server signs a seed token with an HMAC and accepts it for one hour; resubmitting that token reproduces the exact first half and applies the new tactics from Q3 onward. Invalid or modified tokens are rejected. Replay repeats the same result; a new simulation gets new server randomness. Editing either lineup resets the match.

Finished normal simulations can be saved. The server reconstructs the result from the signed seed and validated setup instead of trusting a client-submitted box score. `/matches` lists the last 50 results tied to the signed-in account or signed guest browser identity and can replay every stored play.

Lineup A can create a one-use BO1, BO3, BO5 or BO7 challenge addressed by a 144-bit random share code. The format is stored with the challenge and cannot be changed by the opponent. BO1 needs one win, BO3 two, BO5 three and BO7 four. The code reveals only the challenge setup and eventual shared series. Lineup A's players, minutes and tactic are locked for the opponent. The opponent builds Lineup B; the server loads both statistical profiles once, generates games until either side reaches the required wins, and stores the complete series. A game tied even after the simulator's overtime limit is retained but awards no series win; the server allows a bounded number of additional games and fails safely if no winner is produced. The same completed URL always reopens the series. Every game has its own box score and replay. Completed challenges are copied into both participants' histories when their identity keys differ.

`match_results` and `match_challenges` are server-owned Supabase tables. `anon` and `authenticated` have no table privileges, RLS is enabled with explicit deny policies, and only the service-role server routes access rows. History queries also filter by the current signed user or signed guest identity. Challenge codes act as capability links for the one deliberately shared record.

## Validation

`node scripts/test-match-simulation.cjs` checks 500 games for reconciled totals, valid box scores, clock progression, overtime, rebounds retaining possession, and live scorer snapshots. It also checks eight-player participation, exact 240-minute rotations, manually assigned minutes, zero-minute exclusion, invalid rotation rejection, the 5–8 player boundary, and identical first halves under second-half tactic changes. A further 400 comparison sets exercise rebounding, blocks, pace/turnovers, pressure/fouls, and stronger-shooting lineups.

- Stronger offensive rebound lineup: 92.27 → 96.94 field-goal attempts.
- Stronger blockers: 1.71 → 6.87 blocks.
- Fast vs balanced: 103.98 → 121.84 possessions, with 12.88 → 20.07 turnovers.
- Pressure defense: 8.52 → 10.94 steals, conceding 22.39 → 27.88 free-throw attempts.
- Deliberately stronger synthetic shooting/turnover profile won 383 of 400 comparisons.

These check directional behavior, not predictive calibration. Do not present the synthetic win rate as a real team forecast. `node scripts/check-simulation.cjs` verifies the real local API with three independent eight-player games, exact rotations, signed halftime continuity, token tampering, invalid sizes/positions/IDs/tactics, and cross-origin rejection. TypeScript also checked.

Before public competitive use: acquire historical player lineup/minute data for held-out matchup calibration, test position/rotation balance more broadly, add durable result records and request rate limits. Mobile-specific refinement remains deferred.

Browser verification: manual minute edits disable tip-off away from 240 and auto allocation restores it; a challenge link locked Lineup A, accepted an opponent rotation, completed 129-101, reopened with the same result, and appeared in Match history; a BO3 challenge completed 1-2 with game scores 123-105, 112-121 and 111-125; all three games were selectable in the challenge and history views; saved normal simulation also entered history; stored box scores contain MIN and Watch replay; no console errors. The local API returned three distinct games and preserved the first half byte-for-byte after a signed halftime resubmission.
