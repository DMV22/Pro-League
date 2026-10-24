# M3 Public Walking Skeleton exit gate

Status: **GO — internal read-only M3 acceptance approved by the project owner on
2026-10-24.** Final evidence review completed through merged PR #119; #97 and M3 /
#37 are closed as completed. The scoped Performance restoration obligation remains.
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

The final application candidate is `e90033445923ea3787acdc75b68deb3ab1524789`.
Earlier local results below retain their original scope and are not relabelled as
CI or cloud evidence. See the final-candidate evidence section for immutable links.
Implementation-session notes keep their historical then-pending status; this
checklist and the final-candidate section describe the current verification state.

| Gate | Required result | Evidence/status |
| --- | --- | --- |
| Candidate | Pin application SHA on `develop`, trusted controller SHA, migration inventory and Golden digest | Pinned below; three reviewed migrations and stable Golden digest verified |
| Full public journey | Actual links and expected entries, Fixture Round, current Result and provisional Standings in an isolated Preview | Pilot #117 read-only checks and retained 12-case cloud CI collection passed |
| Published-only | Draft/Private/superseded and private personal fields absent from public response, serialized payload and metadata | CI passed: 12 dedicated PostgreSQL browser checks and full 56-case milestone matrix |
| PostgreSQL/migration | Real PostgreSQL integration, clean install, repeat application, populated upgrade, drift and Golden verification | Final-candidate baseline passed |
| Browsers | Relevant journey on Chromium, Firefox and WebKit; representative mobile viewport; required tests executed, not fixture-skipped | Final-candidate milestone passed 56/56; no retries/skips |
| Accessibility | Automated public-route checks plus manual keyboard smoke; no claim of complete screen-reader conformance from axe alone | Milestone axe and cloud 6/6 passed; keyboard observation linked below |
| Cache/outage | Committed-source freshness, bounded warned warm fallback, cold/expired unavailability and no revival of hidden data | Final-candidate real-PostgreSQL + 2/2 dedicated browser checks passed; exact expiry uses injected clock |
| Lighthouse | Production build; required strict baseline passes; additional route measurements/Preview exceptions reported separately | Strict baseline passed; cloud diagnostic reports/traces retained for 90 days and downloaded summary verified |
| Preview lifecycle | Correct PR binding, exact deployed SHA, synthetic notice/noindex, automatic cleanup and verified provider absence | Pilot #117 controller passed, PR closed without merge, cleanup run passed and ownership record is cleaned |
| Decision | No unresolved blocking failure; explicit internal acceptance and outstanding UI restoration obligations | Owner GO on 2026-10-24 after PR #119 review/merge; #97 and #37 completed within the unchanged scoped exception |

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

## Final-candidate evidence — 2026-10-24

These results concern internal read-only M3 acceptance, not Production or an
Official launch. Application baseline: `e90033445923ea3787acdc75b68deb3ab1524789`
on `develop` after [PR #116](https://github.com/DMV22/Pro-League/pull/116).
The disposable [pilot #117](https://github.com/DMV22/Pro-League/pull/117) head is
`909d24c9533a1bab9024b12192af15221bf78bae`; its only difference is the added static
marker `public/m3-acceptance-pilot.txt`. No UI, query, schema or fixture changes
are hidden in that pilot. It was closed without merge on 2026-10-24T17:19:50Z.

### PostgreSQL, migration, privacy and cache

The [final develop baseline](https://github.com/DMV22/Pro-League/actions/runs/40111252292)
passed production build, quality, types, all 156 unit cases, strict baseline
Lighthouse and the real-PostgreSQL jobs. The separately seeded browser executions
actually ran: navigation/content/axe 16/16; M3 privacy response/metadata 12/12;
cache-degradation/source-change desktop/mobile 2/2. Default fixture-based skips in
ordinary generic jobs are not substituted for those dedicated executions.
The enhanced private-parent/child controls belong to the disposable CI privacy
fixture, not the cloud database. Cloud evidence uses the unchanged reviewed
application and controller-verified Golden fixture; it does not claim those extra
CI-only records were inserted into Preview.

Migration evidence includes clean install, ledger and repeat application,
deterministic Golden install/reset, clean/reference schema equality and populated
previous-release upgrade without participant drift. Three reviewed migrations
were verified. Stable relationship digest:
`356709a5a2fd1b8d430751f3d00a1e071d85f742d05f730cc0caec9cadc9c961`.
Normalized schema digest:
`da117a4a02ded8469096e9f24186cda2c360bd67cb1fa09bdfc2ece7a0428f99`.

Cache evidence covers committed source refresh, warned warm fallback with an
unchanged source timestamp, cold restart unavailability, confirmed hiding and no
revival during a later outage. The exact five-minute expiry boundary is tested
with an injected clock; no five-minute cloud outage or mutation was performed.
All mutation/outage fixtures used disposable local/CI databases, not shared Golden
data, the Neon parent or this read-only cloud Preview.

### Cross-browser and accessibility

The [final develop M3 run](https://github.com/DMV22/Pro-League/actions/runs/40111252283)
passed 56/56 cases, exactly 14 per Chromium desktop, Chromium mobile, Firefox and
WebKit, with zero retries/skips. The downloaded `acceptance.json` records a clean
checkout of `e900334`, no matrix failures and the immutable run URL. The retained
[browser artifact](https://github.com/DMV22/Pro-League/actions/runs/40111252283/artifacts/12566649775)
expires on 2027-01-22. Tool versions: Node 22.14.0, Playwright 1.63.0, Chromium
153.0.8010.12, Firefox 155.0, WebKit 26.6.

Read-only cloud checks against the exact PR117 origin passed navigation 6/6 and
axe 6/6 on desktop/mobile, without retries. The journey followed real links from
home through Competition and Season, asserted Entries and representative Fixture
Rounds, the current technical Result `0:3` rather than superseded `2:1`, postponed
Match presentation and provisional Standings (3, 0 and -1 points). Canonical and
missing public routes also passed.

[Keyboard observation with screenshots](https://github.com/DMV22/Pro-League/pull/117#issuecomment-6386891498)
confirmed skip-link Enter focuses `main`, Tab/Enter reaches Competition and Season,
visible unobscured focus rings, a keyboard-reachable Standings wrapper and reverse
traversal. This is a limited observed keyboard smoke, not a complete screen-reader,
physical-device Safari, zoom/high-contrast or WCAG-conformance certification.

### Cloud provenance, Performance and retention

The [successful original controller run](https://github.com/DMV22/Pro-League/actions/runs/40111944551)
used controller revision `3b80fe95a55c32ebde96de9bc955beb647fd4f8f`, the exact pilot
head, and reviewed migration hash
`ec6ab54dea4381232ba05eda8030f7aec24781e224abb713f11e5946b688cb77`.
It reached `ready` after Golden verification, exact deployment SHA/binding checks,
server HTML, synthetic notice, noindex and browser smoke. Initial observed Render
`Application loading` HTTP503 pages were before readiness, not application
acceptance results. No failing required assertion was retried until green.

[PR #118](https://github.com/DMV22/Pro-League/pull/118) installed the separate
read-only collector on `main`, without promoting application code. Collector SHA:
`ef736d975db1558c809fb5a624b833f90e1c527c`.
Its [first dispatched run](https://github.com/DMV22/Pro-League/actions/runs/40114988152)
passed on attempt 1: 26 guard checks, credential-free smoke, 12 navigation/axe
cases, six fresh route Lighthouse measurements, identity recheck and the complete
evidence summary. The
[cloud artifact](https://github.com/DMV22/Pro-League/actions/runs/40114988152/artifacts/12568202029)
has 90-day retention from workflow creation (expires 2027-01-22T17:11:28Z).
It copies the original controller's seven-day reports/traces and retains the new
browser reports/traces, route measurements, raw network/trace assets, actual tool
versions and before/after identity metadata. The downloaded archive was inspected:
`acceptance.json` is `passed`, all before/after target values match, all 12 browser
trace ZIPs are present, and six controller plus six route raw trace/network sets
are present. The browser runner used Node 22.14.0, Playwright 1.63.0 and Chromium
153.0.8010.12. The summary expressly excludes final owner acceptance and cleanup.

Retained mobile Lighthouse results (median, with min–max in parentheses; three
equivalent navigations per URL):

| Route | Performance | LCP ms | TBT ms | CLS |
| --- | --- | --- | --- | --- |
| Home, copied controller | 97 (84–97) | 2103.8 (2085.8–3168.8) | 92 (87–334) | 0 |
| Admin, copied controller | 98 (98–98) | 2089.0 (2089.0–2094.6) | 86 (82.5–88.5) | 0 |
| Competition, fresh collector | 90 (90–93) | 2969.1 (2252.9–3100.2) | 39.5 (38.5–247) | 0 |
| Season, fresh collector | 89 (88–94) | 3339.7 (2938.3–3650.4) | 48.5 (41.5–96) | 0 |

All twelve reports have Accessibility 100 and Best Practices 96; non-exempt
median assertions passed. Fresh route measurements used Lighthouse 12.6.1,
HeadlessChrome 155 on Linux, simulated mobile 412x823 at device scale 1.75, CPU x4,
RTT 150 ms / throughput 1638.4 Kbps, with storage reset between navigations.
Copied controller measurements retain their own conditions in the archive; do
not assume the later collector's browser or timestamp applies to them.

The 90-day milestone archive covers M3 browser/cloud evidence, not a retroactive
retention change to ordinary baseline artifacts. The baseline's original
Lighthouse artifact keeps its existing seven-day lifetime; its successful strict
job result and immutable CI run remain separately referenced above.

The original local three-run mobile measurements are retained in the linked pilot
comment with their Windows/Chrome/Lighthouse versions and conditions; they are not
relabelled as CI values or directly compared as a regression. Required local/CI
baseline Lighthouse passed strict unchanged budgets. Additional Competition/Season
and opt-in trusted-cloud Performance remain **diagnostic exceptions, not strict
Performance passes**. Raw metrics, medians/ranges and collection conditions belong
to the cloud summary. Field data is unavailable, not passed. The previously agreed
replacement-UI restoration obligation remains in force; it is not broadened here.

### Cleanup and final decision

Archive-content verification and pilot closure without merge are complete.
The [closure cleanup run](https://github.com/DMV22/Pro-League/actions/runs/40115623928)
passed both `inspect` and `reconcile`. PR117 is `CLOSED` with `mergedAt: null`.
Its [signed ownership record](https://github.com/DMV22/Pro-League/pull/117#issuecomment-6386744781)
now records `cleaned` for the same SHA; the PR has no remaining Preview or cleanup
alert labels. This is controller-mediated provider-absence evidence, not an
independent unauthenticated HTTP404 test or a fresh manual provider API audit.
The reviewed adapters confirm absence with provider GETs after deletion before
the controller saves `cleaned`: Render service `srv-dbedu9dg1s2s739a680g` and Neon
branch `br-cool-dawn-b9cgzkgu` are the owned resources addressed by this run. The
Preview database is removed with its branch; the empty parent and unrelated
resources are not deletion targets. No manually supplied provider credentials
were required for acceptance or cleanup verification.

No unresolved functional, privacy, migration, browser, non-exempt audit, isolation
or cleanup failure was found in this final evidence set. The previously approved
provisional-UI Performance exception remains exactly scoped as above; restoring
strict measurements before replacement-UI acceptance is an outstanding obligation,
not an unrecorded waiver or a claimed Performance pass.

After review and merge of [PR #119](https://github.com/DMV22/Pro-League/pull/119),
the owner explicitly approved **GO for internal read-only M3 acceptance** on
2026-10-24 and authorized closure. The decision and evidence links are recorded in
[#97](https://github.com/DMV22/Pro-League/issues/97). Its four acceptance criteria
are checked and it is closed as completed. All seven native M3 child issues
(#91–97) were verified closed before closing [#37](https://github.com/DMV22/Pro-League/issues/37).

Approval concerns only the read-only M3 walking skeleton. M4
Admin/Audit/idempotency/outbox work is not marked complete; the overall MVP release
milestone remains open. No federation, Production or Official launch approval is
implied. This sign-off records the existing provisional-UI Performance exception,
not an extension of it or a strict Performance pass.

## Evidence and closure

For each result retain the immutable SHA, UTC timestamp, environment, browser/tool
versions, workflow URL, report/artifact link and expected/actual outcome. Preserve
initial failures and classify any infrastructure retry. Milestone artifacts need
90-day retention; sanitized summaries remain versioned with issue links. Never
publish credentials, private files or real personal data.

After implementation PR review/merge, verify the final candidate and automatic
cleanup, replace pending rows with evidence, then decide whether to close #97 and
M3 / #37. This policy document alone does not satisfy or close either issue.
