# Guesser development — 2026-08-31

Implemented locally; database migration applied to fdlcdiqvbldqwjbbdjhv. Git, deployment, MongoDB and mobile-specific work remain deferred by request.

## Gameplay

- Current and All-Time daily/practice modes use server-held sessions. Browsers send only a selected player ID, session ID and expected version.
- Six total moves; a hint consumes one move, maximum four hints. Duplicate guesses do not consume a move. The sixth incorrect guess/hint ends the game. A correct sixth guess wins.
- Before completion the response contains stats, earned hints and comparison feedback, but no answer ID/name/biography/image URL. The mystery image is a neutral silhouette. The real photograph and profile link appear after completion.
- Incorrect guesses compare stored team, position and country; height and draft-year arrows describe the target relative to the guessed player. Missing data is explicitly unknown.
- Each era has one random daily answer saved as an immutable snapshot for the UTC date. Updating NBA source data does not change an existing challenge. New daily games cannot be reset. Expired daily attempts are rejected.
- Practice resumes on reload. New player is available after completion. Database locking limits creation to 30 sessions per identity in a rolling hour; parallel requests cannot bypass it.
- GET reads progress; POST starts/resumes/mutates. All game responses are private/no-store. The legacy random-player route uses the same protected practice flow rather than exposing an answer.

## Identity and privacy

- Verified Supabase accounts use user ID ownership; two devices on the same account resume the same game.
- Guests use a random signed HttpOnly, SameSite=Lax cookie (Secure in production). Guests and accounts have separate histories, explained in the UI. Clearing cookies starts a new guest identity; this is not competition-grade anti-cheat.
- New tables guesser_challenges and guesser_sessions have RLS enabled and all PUBLIC/anon/authenticated privileges revoked. Only the server service role can access them. The start_guesser RPC is SECURITY INVOKER with fixed search_path and service-only EXECUTE.
- Every game read/update is restricted by verified owner plus era/mode. Conditional updates using the expected version prevent concurrent moves and retry double-counting.
- An existing server-only SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY is required. Optional GUESSER_COOKIE_SECRET overrides the signing key; otherwise the service key is used with a dedicated domain prefix. Never use a NEXT_PUBLIC variable for either secret. Changing the signing key invalidates guest cookies.
- Same-origin POST guard and small JSON payload validation are included. Dedicated bot/WAF/IP throttling and guest-data retention remain future production operations; cookie reset/multiple accounts cannot be prevented by these game rules.

## Daily statistics and home

- Separate Current and All-Time completed-game count, wins, win percentage, current/best daily win streak, winning-attempt distribution. Hints count toward attempts. Practice is excluded.
- A skipped day or loss breaks the streak; an unfinished challenge today preserves yesterday's streak until today is resolved/ends. Played/win rate count completed games, not abandoned sessions.
- Home shows both daily challenges as not started/in progress/solved/completed with links to continue or view the result. Existing home content was preserved.
- Copy result produces a spoiler-free text with challenge date, score, hint/guess squares and game link. If clipboard access fails, selectable result text appears.
- Previous browser-only saved games are not imported as verified results.

## Validation

- scripts/check-guesser.cjs: real Next API + PostgREST tests for two guest identities, private-table/RPC denial, same daily snapshot, ownership, concurrency, duplicate guesses, hints, win/loss, statistics, all routes and origin rejection. Test guest records are deleted afterwards.
- scripts/check-guesser-accounts.cjs: two temporary real Auth accounts; private-table denial, ownership, second-device resume, account statistics. Tokens revoked, test games/accounts deleted afterwards.
- scripts/test-guesser-rules.cjs: streak gaps/losses/unfinished today/month rollover, zero games and comparative hints.
- TypeScript and production build passed. Initial restricted-network build could not download the existing Google Geist font; rerunning with network access succeeded. Existing dependency/middleware/metadata warnings remain.
- Browser: daily hint persisted after reload; wrong guess displayed comparison feedback; correct guess ended the game, revealed the photo and updated win rate/streak/distribution. Copy result confirmed success without exposing the answer in shared text.
- Additional API checks passed: practice cannot reset while unfinished, a completed practice can start a new session, practice does not change daily stats, the creation limit returns 429, expired daily sessions reject moves.
- Draft years stored as decimal text (e.g. 2018.0) are normalized for comparisons and hint display without modifying source NBA records.
- Supabase security advisor: no ERRORs. The two new INFO notices for RLS without policies are intentional service-only tables: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy. Existing public-content GraphQL and leaked-password warnings are unchanged.

## Limits

All-Time currently uses the existing historical biography dataset's PTS/REB/AST, which are not guaranteed career averages (explicit UI label). Team comparisons use the stored team, not career history. This change does not repair NBA data completeness or image licensing. Stats are clues and can naturally identify a player when matched against public NBA data; hiding the answer prevents direct API/image-ID disclosure, not external research or answer sharing. There is no public leaderboard or prize system.
