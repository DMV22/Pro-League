# Provisional League Standings (M3 / #93)

The public Season page derives a provisional table on the server. It never writes official
Standings rows or reads a browser-maintained table. Finalization and the complete ranking
engine remain M9 work; cache freshness/invalidation remains #94 work.

## Supported inputs

- Current standalone League Stages in the Season's current Format Version (not Group Stages
  or Knockout Stages).
- All currently assigned public Stage participants, including teams without Matches.
- Current Published Finished Match Result Versions, with played regulation + extra-time
  goals or Technical Result goals. Superseded Result Versions are not counted. Postponed
  Matches contribute no result, even if a Result pointer exists.
- A configured integer Points Scheme and ordered `goal_difference`, `goals_scored`, `wins`
  criteria, using their configured ascending/descending direction.
- Effective Standing Adjustment chains: `apply`, `replace`, `revoke`. Only each chain's
  effective terminal decision contributes; independent chains are additive.

Inputs are read in one short read-only `REPEATABLE READ` transaction. Calculation happens
after the transaction completes. The effective date is the civil date in the Season's
timezone, derived from an explicit instant (injectable for tests).

Incomplete/hidden Stage or Match participants, Finished Matches without a usable current
Result, unsupported ranking/participation rules, or invalid adjustment chains produce an
explicit unavailable state for that Stage. No private team name or partial ranking is shown.
Non-registered participation states are conservatively unavailable until their consequences
are implemented. Equal statistical rankings retain shared places (e.g. 1, 1, 3); participant
slot order only stabilizes presentation within a tie.

## Implementation flow

1. The Season route resolves public slugs and starts content and Standings reads independently.
2. `public-league-standings.ts` owns the transaction and Season-local effective date.
3. `createPublicSeasonStandingsQueries` reads current Stages, assignments, Results, rules and
   decisions. This low-level reader requires its caller to own the snapshot; rollback-only
   integration fixtures can supply their existing transaction without opening a nested BEGIN.
4. `calculateProvisionalLeagueStandings` performs the pure calculation and returns an
   available/unavailable discriminated result.
5. `SeasonStandings` renders semantic server HTML. The table scrolls within its own
   keyboard-focusable region on narrow screens; it adds no Client Component or chart library.

## Local verification

Use the existing disposable `proleague_golden_seed` database and private `SEED_DATABASE_URL`.
Do not migrate/reset a working database for these checks.

```powershell
pnpm quality
pnpm types
pnpm unit
pnpm db:verify-golden --target=local --confirm-db=proleague_golden_seed
pnpm build
pnpm start:golden
```

Open `/competitions/golden-cup/seasons/2026-golden`. On/after 6 April 2026 in the Season's
timezone, the standalone League rows must be:

| Place | Team | Played | W | D | L | GF | GA | GD | Adjustment | Points |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ФК Луг (демо) | 1 | 1 | 0 | 0 | 3 | 0 | 3 | 0 | 3 |
| 2 | ФК Явір (демо) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 3 | ФК Берест (демо) | 1 | 0 | 0 | 1 | 0 | 3 | −3 | −1 | −1 |

Сокіл is not a participant of this League Stage and must not appear in its table.

With `start:golden` running, use another PowerShell terminal:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3000'
$env:PUBLIC_NAVIGATION_TEST_FIXTURE = '1'
pnpm exec playwright test tests/e2e/public-season-content.spec.ts tests/accessibility/public-navigation.a11y.spec.ts --project=chromium --project=chromium-mobile
Remove-Item Env:PLAYWRIGHT_BASE_URL, Env:PUBLIC_NAVIGATION_TEST_FIXTURE
```

CI also runs rollback-only PostgreSQL query checks covering private/unresolved inputs,
current Technical Result corrections, replacement/revocation dates and unsupported rules.
The Golden verifier checks exact totals and the timezone boundary without modifying the seed.
