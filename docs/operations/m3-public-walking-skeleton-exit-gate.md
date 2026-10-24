# M3 Public Walking Skeleton exit gate

Status: planned; acceptance has not been executed or granted.  
Issue: [#97](https://github.com/DMV22/Pro-League/issues/97), part of [M3 / #37](https://github.com/DMV22/Pro-League/issues/37).  
Policy approval: project owner, 2026-10-24, option A in the implementation-plan discussion.

## Scope

Verify `ACC-PUBLIC-001`: a Visitor follows Competition to Season, Season Entries,
one representative Fixture Round, current Match Results and provisional Standings.
Use Published synthetic data and the existing PostgreSQL/application-query/Server
Component boundaries. Match Results may be presented inside the Season; this gate
does not require a new Match detail route or a redesigned homepage.

The read-only exception defers Admin mutations, Audit History, command idempotency
and transactional outbox delivery to M4. Preview-controller idempotence and cleanup
remain required and are not waived. This is internal technical acceptance, not
federation approval, Production deployment or Official launch.

## Approved temporary Performance scope

Owner: project owner (internal acceptance decision); Developer owns collection,
accurate reporting and restoration work. No separate federation sign-off is claimed.

Carry forward only the existing approved exceptions:

- Additional mobile Competition/Season Performance measurements are diagnostic
  while their UI remains provisional, as recorded for #94.
- The trusted controller's existing opt-in for an exact Render PR Preview host
  makes home/Admin Performance scores, home LCP and home TBT warnings, as approved
  for #96. See [the controller runbook](https://github.com/DMV22/Pro-League/blob/main/docs/operations/preview-bootstrap.md#temporary-cloud-performance-exception--issue-96)
  on trusted `main`; application work on `develop` must not alter controller code
  or inherit provider credentials to reproduce this policy.
- Existing required baseline/local strict checks retain their budgets and remain
  blocking. No blanket severity downgrade, automatic retry-until-green,
  `continue-on-error`, skipped audit or quarantine is authorized.

Risk: the provisional UI may miss mobile/cloud loading and responsiveness targets.
Mitigation: retain comparable three-run reports and traces, record actual scores
and metrics, and mark each row as strict pass, diagnostic exception, fail or not run.
Do not treat an empty/unconfigured page's green report as Golden-path evidence.

Expiry: before acceptance/release of the replacement UI, not an indefinite waiver.
At that gate, remove the controller diagnostic opt-in through a reviewed `main` PR,
restore strict mobile/cloud measurements on the agreed representative routes and
record passing results against the unchanged numeric budgets. Revisit scope at the
M3 go/no-go; any extension needs an explicit new decision in the issue.

Always blocking: functional correctness, privacy and Published-only boundaries,
migration integrity, applicable cross-browser and accessibility checks, CLS,
non-exempt Lighthouse assertions, successful collection, server HTML, noindex,
exact deployment SHA, Golden verification, database isolation and safe cleanup.

## Execution plan and evidence checklist

All rows are pending this issue's final candidate; prior evidence may be linked
only with its original SHA, scope and limitations stated explicitly.

| Gate | Required result | Evidence/status |
| --- | --- | --- |
| Candidate | Pin application SHA on `develop`, trusted controller SHA, migration inventory and Golden digest | Pending |
| Full public journey | Actual links and expected entries, Fixture Round, current Result and provisional Standings in an isolated Preview | Pending |
| Published-only | Draft/Private/superseded and private personal fields absent from public response, serialized payload and metadata | Pending |
| PostgreSQL/migration | Real PostgreSQL integration, clean install, repeat application, populated upgrade, drift and Golden verification | Pending |
| Browsers | Relevant journey on Chromium, Firefox and WebKit; representative mobile viewport; required tests executed, not fixture-skipped | Pending |
| Accessibility | Automated public-route checks plus manual keyboard smoke; no claim of complete screen-reader conformance from axe alone | Pending |
| Cache/outage | Committed-source freshness, bounded warned warm fallback, cold/expired unavailability and no revival of hidden data | Pending |
| Lighthouse | Production build; required strict baseline passes; additional route measurements/Preview exceptions reported separately | Pending |
| Preview lifecycle | Correct PR binding, exact deployed SHA, synthetic notice/noindex, automatic cleanup and verified provider absence | Pending; reuse #96 evidence only for its established scope |
| Decision | No unresolved blocking failure; explicit internal acceptance and outstanding UI restoration obligations | Pending |

Run mutation/outage fixtures only in dedicated disposable local/CI databases,
not in shared Golden data, the empty Neon parent or Production. Browser acceptance
against Preview is read-only and does not receive provider credentials. Existing
#96 safety pilots need not be recreated merely to repeat their completed evidence.

## Implemented first slice: public journey and privacy controls

`tests/e2e/public-navigation.spec.ts` now traverses the full read-only Golden
journey, including current technical Result and provisional Standings. It reuses
the same Season assertions as `public-season-content.spec.ts`. For a read-only
Preview run, set `PUBLIC_PREVIEW_SMOKE=1` and `PLAYWRIGHT_BASE_URL` to the exact
selected `https://pro-league-development-pr-N.onrender.com` origin. This does not
allocate a Preview or prove its deployment SHA; collect controller evidence too.

`public-published-only.spec.ts` uses a separate, explicitly confirmed loopback
database named `proleague_m3_acceptance_local` or `proleague_m3_acceptance_ci`.
Create an empty database and apply the reviewed migrations with its dedicated
`MIGRATION_DATABASE_URL` first. Do not point these commands at shared Golden data.
Set `M3_ACCEPTANCE_DATABASE_URL` privately to that same dedicated URL, then run:

```powershell
pnpm exec tsx scripts/db/prepare-m3-acceptance.ts --confirm-db=proleague_m3_acceptance_local
$env:DATABASE_URL = $env:M3_ACCEPTANCE_DATABASE_URL
$env:M3_ACCEPTANCE_CONFIRM_DB = 'proleague_m3_acceptance_local'
$env:PUBLIC_M3_ACCEPTANCE_FIXTURE = '1'
$env:PUBLIC_NAVIGATION_TEST_FIXTURE = '1'
pnpm build
pnpm exec playwright test tests/e2e/public-navigation.spec.ts tests/e2e/public-season-content.spec.ts tests/e2e/public-published-only.spec.ts --project=chromium --project=chromium-mobile --workers=1
```

Use a fresh console or restore the previous environment afterwards. Do not set an
external `PLAYWRIGHT_BASE_URL` for privacy tests: they require a freshly started
local production server, not a reused server from a different database. The seed
refuses populated databases; there is intentionally no reset mode. It creates
Golden data plus private Competition/Season/Team controls, a public child of a
private parent and a noncurrent schedule revision, without changing the shared
fixture implementation or existing databases.

Before negative checks, tests verify the controls actually exist in PostgreSQL.
Complete response HTML (including serialized scripts), rendered metadata and
private-route not-found behavior are checked. Existing Draft Article, private
Match, synthetic exact birth-date and superseded Result controls are included;
this does not claim acceptance of the future editorial or Player-profile modules.
The baseline's real-PostgreSQL job prepares and executes the dedicated privacy
suite explicitly, rather than relying on its default fixture-based skip.

Cross-browser milestone execution, actual cloud journey, retained milestone
reports, performance evidence and the final go/no-go remain separate pending work.

### Local implementation check — 2026-10-24

The first-slice working tree passed TypeScript, production build and 22 browser
checks on Chromium desktop/mobile against PostgreSQL 18.6 in the dedicated
`proleague_m3_acceptance_local` database. The complete unit suite passed all 143
tests across 28 files, including 10 new target-guard cases. Changed-file lint,
formatting and `git diff --check` also passed.
A repeat seed was rejected as expected and left the Competition count unchanged.
These are local implementation results, not immutable candidate/CI/cloud evidence;
the final checklist above deliberately remains pending.

## Cross-browser milestone gate

`pnpm e2e:m3` uses the separate `playwright.m3.config.ts`; the ordinary PR
configuration still runs its existing Chromium projects. Use the dedicated
fixture and environment from the first-slice instructions, then install engines:

```powershell
pnpm exec playwright install chromium firefox webkit
pnpm e2e:m3
```

The milestone selects only the public navigation, Season content, Published-only
and public accessibility suites. Chromium desktop/mobile, Firefox and WebKit must
each execute all 14 required cases (56 total), with zero retries and no `only`,
expected failure, skip or fixme satisfying the gate. The evidence reporter also
rejects filtered/missing projects or files and duplicate cases. When deliberately
adding/removing scenarios, review the explicit case-count contract and its tests.

`artifacts/m3-browser/` contains HTML/JSON reports, traces for every test, an
`acceptance.json` summary with actual checkout SHA/dirty-worktree status and CI run
link, and the actually launched browser/Node/Playwright versions. Dirty local
runs are implementation diagnostics, not immutable candidate evidence. A passing
browser gate is not cloud, Lighthouse, migration or full M3 acceptance.

`.github/workflows/m3-acceptance.yml` prepares an isolated PostgreSQL 18.6 fixture,
builds the app and runs this gate. It uses only disposable local database values
and the existing Docker Hub pull credentials, not Neon/Render/state-key secrets.
Its `e2e-cross-browser` job uploads synthetic evidence on success/failure with
90-day retention and removes only its job-owned Compose resources afterwards.
Path-filtered PR/push runs on `develop` cover changes to this acceptance suite;
they are not a claim that every future application change receives the milestone
run. Re-run against the final candidate. Manual dispatch requires the workflow
to be present on GitHub's default branch; do not silently promote unrelated
application/controller changes to `main` merely to enable that trigger.

Automated axe now covers home, Competition and Season on every milestone engine.
This does not replace manual keyboard smoke or screen-reader review. Browser
engines/emulated viewports do not prove physical Safari/iPhone behavior.

### Local cross-browser implementation check — 2026-10-24

The complete matrix passed 56/56 cases, exactly 14 per profile, with zero retries
or skips. The reporter independently recorded `passed` with no matrix failures.
Versions: Node 22.14.0, Playwright 1.63.0, Chromium 153.0.8010.12, Firefox 155.0,
WebKit 26.6. The same dedicated local PostgreSQL fixture was read, not reseeded.

A deliberate one-case Chromium selection passed its test but the reporter made
the CLI fail specifically for incomplete coverage. This negative control is not
a failed functional journey. Before that control reached tests, two setup runs
failed: duplicate inherited `webServer` entries and Node's JSON import-attribute
requirement. Both were fixed; the single-server fix has a regression test. These
startup failures are not counted as successful guard evidence or hidden by retries.

Local reports/traces are under `artifacts/m3-browser/`. Their metadata correctly
identifies parent SHA `a79d0b67d95f0e0a1cf62c4d008a2267aa42b368` with a dirty
implementation worktree and no CI run URL. They therefore do not replace reviewed,
immutable candidate or cloud evidence. No provider resources changed. The 90-day
workflow upload is implemented but has not yet executed on GitHub.

During the final verification, a two-worker unit run hit a five-second config
import timeout and a separate forks-worker startup timeout. These are retained
as failed local verification evidence, not passing assertions. No test was
quarantined and no timeout or retry budget was changed. The sequential repeat
`pnpm exec vitest run --maxWorkers=1` passed all 156 tests across 30 files.
Changed-file formatting and `git diff --check` passed. Previously completed
TypeScript, production-build and repository quality checks remain local evidence;
no cloud acceptance or final milestone approval is implied.

## Evidence and closure

For each result retain the immutable SHA, UTC timestamp, environment, browser/tool
versions, workflow URL, report/artifact link and expected/actual outcome. Preserve
initial failures and classify any infrastructure retry. Milestone artifacts need
90-day retention; sanitized summaries remain versioned with issue links. Never
publish credentials, private files or real personal data.

After implementation PR review/merge, verify the final candidate and automatic
cleanup, replace pending rows with evidence, then decide whether to close #97 and
M3 / #37. This policy document alone does not satisfy or close either issue.
