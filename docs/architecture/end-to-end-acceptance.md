# End-to-end acceptance and release gates

## Purpose

This blueprint defines the executable evidence required to accept a ProLeague vertical slice, milestone, Production deployment, and Official launch. It consolidates the domain, persistence, security, performance, accessibility, recovery, and federation checks without requiring every rule variation to run through a browser.

The catalogue is a test and release contract, not an implementation choice. Test runners, CI syntax, and provider commands may change while scenario identifiers and observable outcomes remain stable.

## Gate levels

| Gate | Trigger | Required evidence | Decision owner |
| --- | --- | --- | --- |
| PR | Every proposed change | Changed-scope checks plus the blocking baseline; a reviewable Preview for runtime-changing PRs | Developer |
| Milestone | Completion of a vertical slice or foundation milestone | Full slice Definition of Done, representative browser journey, PostgreSQL behavior, accessibility, and domain acceptance | Developer and acting Admin |
| Production deployment | Promotion of a release candidate to `main` | Immutable RC evidence, migration and recovery rehearsal, provider integrations, security controls, and safe smoke plan | Technical Operator |
| Official launch | First public federation release | All launch journeys, federation acceptance, validated initial data, private Production rehearsal, restore evidence, and joint go/no-go | Technical Operator and Admin |

The Public Walking Skeleton is an explicit milestone exception: because it is read-only, it does not require an Admin mutation workflow, Audit History, idempotency, or outbox delivery. It must still prove the final PostgreSQL-to-query-to-server-rendered-public-page boundary and Published-only behavior.

## Canonical blocking jobs

Stable job names allow branch protection to require the intended evidence even if internal commands evolve.

### Pull request baseline

- `quality`: lint and formatting verification;
- `types`: TypeScript checking without emitting build artifacts;
- `unit`: domain, application, query-mapping, and component unit tests;
- `postgres-integration`: repositories, constraints, transactions, locks, authorization persistence, and outbox behavior against the Production PostgreSQL major version;
- `migration`: empty installation, preceding-version upgrade, deterministic seed, repeat deployment, and schema-drift preparation;
- `build`: a Production Next.js build;
- `e2e-chromium`: affected critical journeys plus the cross-module smoke subset;
- `accessibility`: automated checks for affected public and Admin routes;
- `lighthouse`: affected representative routes against the Production build.

Documentation-only changes require the relevant documentation/quality checks but do not allocate a Preview application. Runtime-changing PRs receive a reviewable Preview.

### Milestone and release candidate additions

- `e2e-cross-browser`: Chromium, Firefox, and WebKit coverage for the milestone catalogue;
- `security`: dependency, configuration, authorization, upload, secret, and privacy checks;
- `load`: the accepted public/Admin workload and resource envelope;
- `backup-restore`: isolated encrypted-backup restoration and validation;
- `release-checklist`: manual evidence, ownership, waivers, and federation sign-off.

No job is considered passing when a required test is merely quarantined.

## Acceptance data

### Golden Season

One deterministic fictional Golden Season supplies stable identifiers and expected outputs across Local, CI, and Preview. It contains:

- league, group, fixed-bracket, and redraw knockout stages;
- one-match and two-leg Ties, direct Penalty Shootouts, a Bye, and a Third-place Match;
- a Rest Slot, alternate home field, non-simultaneous Fixture Round, postponement, and Schedule Revision;
- Played and Technical Results, a protest/ruling correction, Standing Adjustment, blocked progression, and final snapshots;
- Team Applications, Season Entries, roster windows, a transfer, Legionnaire quota and birth-date allowance, an eligibility exception, and a minor-publication case;
- Draft, Scheduled, Published, corrected, and Archived Articles with synthetic Media Assets.

Expected Standings, Aggregate Scores, Qualification Outputs, bracket destinations, roster decisions, public projections, Audit Events, and outbox intents are version-controlled. The fixture never contains real Player data or Production-derived identifiers.

### Isolated fixtures

Small scenario-owned fixtures cover uniqueness conflicts, concurrency, stale versions, authorization failure, privacy deletion, cache failure, storage failure, dispatcher retries, and restore drills. They must not make the Golden Season order-dependent.

## Scenario format

Every catalogue entry uses a stable ID and records:

- applicable gate and environment;
- role and initial fixture state;
- Given/When/Then actions;
- domain and persistence outcome;
- public projection outcome;
- Audit History, outbox, and cache effects where applicable;
- critical failure path;
- automated or manual owner;
- link to retained evidence.

Given/When/Then is a documentation convention; adopting Cucumber or another feature-file framework is not required.

## Launch-blocking journey catalogue

### ACC-PUBLIC-001 — Published Official information

**Happy path:** a Visitor follows Competition to Season, Season Entries, Fixture Round, Match, current Match Result, and Standings. Published content is present in server-rendered HTML and remains readable through the accepted cache behavior.

**Critical failure:** Draft, Private, exact-birth-date, private-document, Admin, or Audit data must not appear in public HTML, metadata, sitemap, Open Graph output, query projections, or cache. When freshness cannot be confirmed, the page exposes the accepted stale warning rather than silently claiming currency.

### ACC-AUTH-001 — Invite-only Admin access

**Happy path:** an invited Clerk identity with an Active PostgreSQL Access Grant reaches protected Admin pages and executes an authorized command that records Audit History.

**Critical failure:** missing, suspended, or revoked local grant, stale webhook state, failed authorization, or unavailable required auditing fails closed. Reconciliation and repeated delivery remain idempotent.

### ACC-NEWS-001 — Editorial publication

**Happy path:** an Admin uploads and verifies a synthetic Media Asset, creates structured Article content, previews it, publishes or schedules it, observes the public representation, publishes a correction, archives it, and restores the stable URL.

**Critical failure:** invalid media, derivative failure, inaccessible required metadata, or failed scheduled publication cannot expose a partial Article. Media Withdrawal or Urgent Purge removes public access and records the outcome.

### ACC-SEASON-001 — Competition and Season setup

**Happy path:** an Admin creates Team and Venue/Playing Field master data, a Competition and Season, records and approves Team Applications, creates Season Entries, configures a valid opening Stage, activates the Season, and designates it Current.

**Critical failure:** invalid lifecycle transition, duplicate entry, stale aggregate version, or Audit failure rejects the whole command without a partial state change.

### ACC-SCHEDULE-001 — Format and schedule publication

**Happy path:** an Admin builds a representative hybrid Competition Format, validates and activates it, records an external Draw where required, generates and manually enters Matches, handles a Rest Slot and alternate home field, publishes a partial schedule, revises it, and downloads stable iCalendar events.

**Critical failure:** unresolved source participants, invalid format, overlapping field occupancy, or stale builder autosave cannot overwrite the server-authoritative Draft or Published schedule. A reasoned override is accepted only where the domain permits one.

### ACC-RESULT-001 — Results, Standings, and corrections

**Happy path:** an Admin records a Played Result, observes derived Standings, records a Technical Result or Standing Adjustment, and sees recalculated Published information while prior evidence remains preserved.

**Critical failure:** unresolved protest, ruling, or qualification-boundary tie prevents finalization. A correction cannot silently rewrite prior results or advance a dependent Stage without the required reopening/amendment path.

### ACC-KNOCKOUT-001 — Knockout progression

**Happy path:** fixed and redraw rounds cover one-match and two-leg Ties, direct penalties, a Bye, a Final, and a Third-place Match. Explicit finalization creates the correct progression and immutable snapshot.

**Critical failure:** a suspended Tie, unsettled ruling, incomplete Draw, or unfinalized source cannot activate the next dependent Match. Repeated finalization or outbox delivery produces no duplicate destination participant or output.

### ACC-ROSTER-001 — Roster and eligibility

**Happy path:** an Admin finds or creates a Player Identity, registers the Player, reaches roster readiness, performs an effective-dated Team change during a Roster Transfer Window, and records an allowed Legionnaire exception.

**Critical failure:** out-of-window registration, overlapping active Roster Entry, exceeded Legionnaire quota, unapproved eligibility exception, duplicate ambiguity, or missing minor-publication basis blocks the action and protects exact birth dates and evidence from public output.

### ACC-PRIVACY-001 — Privacy and urgent removal

**Happy path:** an authorized Privacy Request passes Legal Hold review, restricts or deletes eligible live data, invalidates projections, purges public media and caches, records a deletion ledger entry, and reaches an audited final outcome.

**Critical failure:** any mandatory origin, cache, or CDN purge failure keeps the request unresolved, denies unsafe access where possible, and raises a critical alert. Backup expiration remains governed by retention, with the deletion ledger reapplied after restore.

### ACC-OPS-001 — Failure and recovery

**Happy path:** dispatcher claim, retry, lease recovery, dead-letter alert, and replay are idempotent; an encrypted backup restores into isolation; an Admin validates recovered Official information before mutations and scheduled publication resume.

**Critical failure:** PostgreSQL, storage, cache, Clerk, or Audit uncertainty cannot permit an unsafe mutation or false freshness claim. A schema-compatible code rollback works against the expanded schema, and database repair moves forward rather than through an automatic down migration.

## Cross-module journey

### ACC-CROSS-001 — Federation Season Day

This thin journey runs at milestone integration, release candidate, and launch rehearsal:

1. An Admin authenticates through Clerk and passes the local Access Grant.
2. The Admin creates a Competition and Season, Teams, and Season Entries.
3. The Admin configures and publishes a minimal format and schedule.
4. The Admin records a Match Result.
5. The Portal updates the Match and Standings.
6. The Admin publishes an Article associated with the Season and Match.
7. A Visitor sees consistent Season, Match, Standings, and News projections.
8. Audit History and outbox evidence account for every mutation.
9. Repeating idempotent operations creates no duplicate domain record, output, job, or cache intent.

The journey is not required on every PR; affected PRs run a smaller smoke subset.

## Browser and accessibility matrix

- Every runtime PR runs affected critical flows in Chromium.
- Every milestone runs the relevant catalogue in Chromium, Firefox, and WebKit plus automated accessibility checks.
- Before Official launch, current supported Chrome, Edge, Firefox, and Safari receive manual public/Admin smoke coverage at desktop and representative phone/tablet viewports.
- Critical public and Admin workflows receive manual keyboard verification.
- Screen-reader review is required before launch and after material navigation, form, table, or dialog changes.

Real physical devices are not required for every PR. Test evidence records browser/runtime versions.

## Page performance and load

### Lighthouse

Lighthouse CI runs against a Production build, never the development server. Representative routes are home, News list and Article, Competition/Season, schedule, Standings, Match, and Team.

- affected routes run on a PR; the full set runs at milestone and RC gates;
- the median of three mobile runs is evaluated;
- public Lighthouse Performance must be at least 90;
- public LCP must be at most 2.5 seconds, CLS at most 0.1, and Total Blocking Time at most 200 milliseconds;
- a Performance regression greater than five points blocks the change even if the score remains at least 90;
- complex authenticated builders target at least 85 while retaining accessibility and layout-stability requirements;
- after launch, real-user Core Web Vitals are evaluated at the 75th percentile, including INP at most 200 milliseconds.

### Representative load

Before launch, an isolated rehearsal runs 15 minutes of steady load plus a bounded spike, covering 100 concurrent public requests and up to 10 Admin sessions. It measures cached public traffic, cache misses, Standings, schedule, media-rich Article delivery, and an Admin publication/result update during public reads. Evidence includes latency percentiles, error rate, PostgreSQL connections, cache behavior, and Render memory against the 512 MB envelope.

The load test never targets open Production. Failure of a launch SLO is blocking; a lower-risk internal-target deviation requires the waiver policy below.

## Security Review

Before any real Private Document or other ADR-0025 trigger capability is enabled, a versioned Security Review verifies:

- Clerk invitation, session, webhook, revocation, and local Access Grant behavior;
- authorization on every Server Action and Route Handler;
- least-privilege database, storage, migration, backup, and dispatcher credentials;
- signed private access, public-index exclusion, upload size/type validation, EXIF removal, and derivative boundaries;
- secret isolation, log and CI-artifact redaction, dependency scanning, and recovery inventory;
- Audit History and fail-closed behavior;
- CSRF, XSS, open redirect, IDOR, abuse/rate limits, and cache partitioning;
- Privacy Request, Legal Hold, deletion ledger, Media Withdrawal, and Urgent Purge;
- backup encryption and secret-recovery walkthrough.

The Technical Operator and Admin sign the review. Private Document workflows may be developed and tested with synthetic files before sign-off, but real Production documents remain disabled.

## Preview isolation and cleanup

Each runtime-changing PR receives an application Preview. Its database begins from a clean deterministic synthetic baseline; objects use a PR namespace or disposable bucket; identity uses Clerk Development and test identities only. Production secrets, webhook endpoints, personal data, and private files are forbidden.

Closing the PR removes disposable resources and objects. Cleanup failure raises an operational alert so abandoned Preview resources do not accumulate cost. If an economical database-per-PR boundary is unavailable, one resettable Preview database may be used serially; concurrent destructive suites are then prohibited and schema compatibility is verified before reuse.

## Release candidate and Production rehearsal

1. Select a specific `develop` commit and create an immutable tag such as `v0.1.0-rc.1`.
2. Attach the migration version, sanitized CI evidence, and release checklist.
3. Accept only release-blocking fixes during federation review; each fix produces a new RC tag rather than moving the old one.
4. Rehearse migrations, risky jobs, purge, load, and restore on disposable resources.
5. Provision Production privately, invite the Admin, enter or controlled-import initial data, and perform provider-specific checks before public discovery or the official domain is enabled.
6. Run only non-destructive smoke and read checks against open Production.
7. After joint acceptance, promote to `main` and tag the immutable final release such as `v0.1.0`.

Promotion stops before traffic switches when migration, health, or readiness checks fail. After deployment, code rollback begins when a critical public/Admin flow is unavailable, authorization fails open, data is corrupt or disclosed, sustained error/latency thresholds fail, the application cannot read the current schema, stale Official information is shown without warning, or dispatcher behavior is unsafe. Database recovery remains forward-only; unsafe mutations are blocked until corrected.

## Launch observation

The Technical Operator actively monitors the first 60 minutes, including public/Admin smoke, error and latency, PostgreSQL, R2, Clerk, cache, and dispatcher signals. The Admin revalidates key Official information. Enhanced monitoring continues for 24 hours; launch closes only after that window has no unresolved Severity 1 or 2 issue.

During the first hour the Technical Operator may initiate a schema-compatible code rollback. Suspected disclosure, corruption, or incorrect Official information immediately activates the relevant fail-closed or degraded mode and the incident path.

## Severity, waivers, and flaky tests

| Severity | Meaning | Release effect |
| --- | --- | --- |
| 1 | Disclosure or corruption, incorrect Official information, authorization bypass, or total outage | Unconditional no-go |
| 2 | Broken critical public/Admin workflow, migration/backup failure, or material accessibility barrier | No-go |
| 3 | Limited impact with an effective workaround | Requires a dated waiver |
| 4 | Cosmetic or minor issue | Recorded in backlog; does not block |

Authorization, privacy, migration integrity, backup restoration, Official-information correctness, and critical accessibility gates are never waivable. A Severity 3 performance or secondary accessibility exception requires an issue with owner, risk, mitigation, expiry, and joint approval. Final go/no-go is recorded by both Technical Operator and Admin.

A functional failure is not hidden by retry. One retry is allowed only for classified infrastructure/browser instability, and the initial failure remains visible. Critical auth, privacy, migration, result, or progression tests cannot be quarantined. A non-critical quarantined test needs an owner and expiry and cannot satisfy a milestone gate.

## Evidence and retention

- ordinary PR artifacts: 30 days;
- milestone and RC artifacts: 90 days;
- sanitized release checklist, federation approval, restore summary, Security Review sign-off, migration inventory, commit SHA, environment, and dates: permanent versioned Markdown plus GitHub release/issue records;
- performance trends: at least 12 months;
- sensitive security output, secrets, personal data, private files, and full logs: never published as CI artifacts.

The Developer owns automated and technical evidence. The Technical Operator owns deployment, security, recovery, and operational evidence. The Admin or federation representative owns regulation, schedule, Standings, content, initial-data, and usability acceptance. One person may initially perform multiple roles, but each responsibility is still recorded separately.

