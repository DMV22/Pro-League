# Simulator-to-Portal cutover blueprint

## Purpose

This blueprint defines how the checked-in Vite, React, Redux Toolkit, and `redux-persist` learning prototype becomes the production ProLeague Portal. It orders the work without treating browser state as Official information, preserving a second legacy runtime, or attempting a big-bang implementation of the complete MVP.

The target remains the single Next.js modular monolith described by ADR-0011, with PostgreSQL and Drizzle as the authoritative persistence boundary, Clerk invite-only Admin authentication, and the production topology described by ADR-0026.

## Cutover rules

1. Tag the final working prototype as `redux-prototype-final` before replacing the root application in place.
2. Do not import hard-coded or `redux-persist` data. Development and Preview use deterministic synthetic data; Production starts from Admin-validated federation data.
3. Run only one application runtime. The old prototype remains recoverable from Git history and its tag, not from a legacy directory or parallel deployment.
4. Build vertical slices across migration, domain/application rules, persistence, Admin workflow, public projection, audit/outbox, cache invalidation, and tests.
5. Keep domain authority on the server. Redux may return only as an in-memory, route-scoped interaction buffer for the Competition Format or Schedule Builder under ADR-0022.
6. Merge short-lived feature branches into `develop`; promote a reviewed, releasable `develop` to `main`. Each milestone must leave `develop` deployable.
7. Evolve Production schema forward through expand-contract migrations. Application code may roll back to a compatible release; applied shared-environment migrations are never rewritten or automatically run down.

## Prototype disposition

| Prototype asset | Disposition | Condition |
| --- | --- | --- |
| React 19, TypeScript, Tailwind knowledge and useful visual patterns | Reuse selectively | Rebuild against Portal view models and the accepted design direction |
| Table, card, team-list, and round-display concepts | Reference only | Do not preserve their current props or Redux-shaped data contracts |
| Pure selector test style | Adapt | Re-express the useful examples as domain, application, query, or component tests |
| `src/features/league` state, selectors, reducers, hard-coded seeds, and simulation | Remove | Delete after the minimal Next.js shell passes CI and the prototype tag is verified |
| `src/features/ui`, global store, typed Redux hooks, `PersistGate`, and `redux-persist` | Remove | No browser-owned Official information or compatibility adapter is permitted |
| Budget, price, transfer-market behavior, and random result generation | Remove | These are outside the Portal MVP and must not be mapped to domain records |
| Vite entry point, HTML shell, configuration, and Vite-only dependencies | Replace | Next.js becomes the only root runtime |
| Existing CSS and components | Reference only | Rebuild accessible primitives and layouts incrementally; do not require pixel parity |
| Existing Vitest coverage | Preserve intent only | Keep a test only when it asserts a rule that remains valid in the Portal model |
| Debug panel and old branding assets | Remove | No production replacement is required |

No adapter will expose the old Redux graph through the new application. New Server Components and Admin interactions consume purpose-built application queries and serializable view models.

## Delivery milestones

### 0. Prototype Freeze

**Entry:** the current prototype installs, tests, and builds.

**Deliver:** verify the final prototype, record its commands, and create the `redux-prototype-final` tag. Capture the prototype asset disposition above.

**Exit:** the tag can restore a working demonstration and contains no claim that its local data is Official information.

**Rollback:** restore the tag only for demonstration or investigation. It is never a Production rollback target.

### 1. Next.js Foundation

**Depends on:** Prototype Freeze.

**Deliver:** replace the root application with the pinned Next.js App Router foundation; establish public and Admin route groups, Ukrainian document metadata, design tokens, typography, responsive layouts, accessibility baseline, linting, type checking, tests, build, and CI. Add only the primitives needed by the first slice.

**Exit:** a minimal Next.js shell passes CI and can be deployed as a Preview.

**Deletion gate:** remove the Vite entry/build, global Redux provider, `redux-persist`, simulator slices, hard-coded league state, random simulation, commercial transfer behavior, and debug panel. Remove RTK and React Redux until a builder proves the route-scoped need.

**Rollback:** revert the foundation PR while it has no shared data. The prototype remains available from its tag.

### 2. Persistence Foundation

**Depends on:** Next.js Foundation and the relational schema blueprint.

**Deliver:** PostgreSQL/Drizzle structure, the first reviewed SQL migration, transaction adapter, module-owned repositories, read-only Query Layer, deterministic seed command, migration ledger checks, and real-PostgreSQL integration tests.

**Exit:** CI proves an empty installation, repeat execution, repository behavior, and an upgrade rehearsal from the preceding schema where applicable.

**Rollback:** revert application code before any shared migration; afterward retain the expanded schema and forward-fix through a new migration.

### 3. Public Walking Skeleton

**Depends on:** Persistence Foundation.

**Deliver:** a read-only path through `Competition -> Season -> Teams/Season Entries -> one Fixture Round -> Match Results -> Standings`, rendered by Server Components from PostgreSQL through application queries. Use synthetic data, semantic cache tags, and loading, empty, error, and accessible states.

**Exit:** the full request path works in Preview, Published-only boundaries are demonstrated, and the browser owns no sporting truth.

**Rollback:** revert the slice while retaining additive schema. No user data exists to migrate back.

### 4. Admin and Write Foundation

**Depends on:** Public Walking Skeleton. It may begin while final presentation polish is finishing.

**Deliver:** Clerk invite-only authentication, PostgreSQL Admin Access Grants, server-side authorization, Audit History, command idempotency, transactional outbox, typed application outcomes, cache invalidation adapters, and fail-closed mutation behavior.

**Exit:** authentication, active/suspended grant, authorization, audit, idempotency, outbox retry, and cache invalidation integration tests pass before the first Admin mutation is released.

**Rollback:** disable Admin routes and revert compatible code; preserve Audit History and outbox records.

### 5. Media Foundation

**Depends on:** Admin and Write Foundation.

**Deliver:** the Cloudflare R2 adapter, direct upload, verification, Media Asset metadata, bounded derivative processing, public/private key separation, signed-access abstraction, purge behavior, and synthetic integration tests.

**Exit:** public Media Assets can be uploaded, verified, transformed, served, withdrawn, and purged through provider-neutral application contracts. Private access is proven only with synthetic files until the Security Review passes.

### 6. Editorial Slice

**Depends on:** Media Foundation.

**Deliver:** structured News Article Draft, validated public Media Asset upload, preview, publish, revision, archive, public News pages, homepage projection, Audit History, outbox, and cache invalidation. Private Documents remain out of scope.

**Exit:** the complete editorial publication lifecycle passes browser, authorization, media, accessibility, and cache tests.

**Parallelism:** this slice may proceed alongside sporting slices after both share the write foundation.

### 7. Competition Setup

**Depends on:** Admin and Write Foundation.

**Deliver in order:** Team and Venue/Playing Field master data; Competition and Season lifecycle; Team Applications and Season Entries.

**Exit:** an Admin can prepare a valid Season with approved participants while every transition and public projection follows the accepted lifecycle rules.

### 8. Format and Schedule Builder

**Depends on:** Competition Setup.

**Deliver:** Competition Format Drafts, ordered Competition Stages, League/Group/Knockout/Hybrid formats, fixed brackets and redraw rounds, one- and two-leg ties, Third-place Matches, progression slots, Fixture and Rest Slots, generated and manual Matches, schedule validation, publication/revisions, and iCalendar export.

**Exit:** representative formats can be configured, validated, published, revised, and reconstructed from persisted versions. Any route-scoped Redux buffer remains disposable and server-authoritative autosave handles version conflicts.

### 9. Results and Progression

**Depends on:** Format and Schedule Builder.

**Deliver in order:** Played and Technical Results; Result and Tie Rulings; derived Standings and Standing Adjustments; Knockout Draw Outcomes, Byes, tie finalization and progression; Stage/Season finalization and immutable snapshots.

**Exit:** unresolved protests or rulings block affected progression; corrections preserve prior decisions; final snapshots identify the exact rules and results used.

### 10. Rosters and Eligibility

**Depends on:** Season Entries. It may begin after milestone 7 and run alongside milestones 8-9, but does not block format or schedule work.

**Deliver:** Player Identity, Season Rosters, Registration and Transfer Windows, effective-dated Roster Entries, Legionnaire classification and birth-date-based allowances, eligibility rulings, privacy-safe public profiles, and required Private Document controls.

**Exit:** registration, transfer, quota, exception, privacy, and minor-publication scenarios pass domain, authorization, and browser acceptance tests. Private Document behavior is verified with synthetic files; real Production documents remain disabled until the Security Review passes.

### 11. Operational Readiness

**Depends on:** all MVP slices required for official use.

**Deliver:** monitoring, logs, scheduled dispatcher, backup/export and isolated restore, retention jobs, incident and secret-recovery runbooks, security review, capacity verification, accessibility review, cache/urgent-purge verification, and Production rehearsal.

**Exit:** every applicable release gate below has recorded evidence. A technically deployable but incomplete Portal is not described as the federation's official source.

### 12. Official Launch

**Depends on:** Operational Readiness and domain acceptance of the complete agreed MVP.

**Deliver:** provision the private pre-launch Production boundary, invite the Admin, enter or controlled-import initial data, validate Official information, perform smoke and restore checks, freeze changes in the predecessor source, connect the official domain, and open public access.

**Exit:** both technical and federation acceptance are recorded, all public data has an approved source, and subsequent official changes are made only through the Portal.

**Rollback:** before public opening, keep the Portal private. After opening, roll application code back only to a schema-compatible release; use forward corrections for data and schema, and publish an incident notice if currentness cannot be confirmed.

## Vertical-slice Definition of Done

A slice is complete only when every applicable item is present:

1. reviewed migration and PostgreSQL constraints;
2. framework-independent domain and application rules;
3. owning repository and public/admin query projections;
4. authorized Admin workflow;
5. Published-only public projection;
6. Audit History, idempotency, and transactional outbox behavior;
7. semantic cache invalidation and degradation behavior;
8. domain unit, real-PostgreSQL integration, authorization, browser, and accessibility tests;
9. documentation and acceptance evidence.

UI completion alone is not a completed slice.

The read-only Public Walking Skeleton is the deliberate exception to items 4 and 6: it has no Admin mutation, Audit History, idempotency, or outbox requirement. It must still establish the final PostgreSQL, application-query, Server Component, Published-only, cache, and test boundaries.

## Data strategy

### Synthetic fixtures

The deterministic non-production seed must be resettable and contain fictional identities. Its representative Season covers a league, groups, fixed and redrawn knockout rounds, one- and two-leg ties, penalties, a Third-place Match, a Rest Slot, an alternate home field, postponement, a Technical Result, a result correction, blocked progression, roster windows, and Legionnaire limits. It also includes Articles and public Media Assets.

### Production initialization

The browser prototype and non-production fixtures are never imported. The default Production path is controlled Admin entry. If the federation supplies a concrete spreadsheet or CSV, inspect that format first and build a bounded one-off importer with domain validation, dry-run reporting, duplicate and ambiguity detection, explicit Admin confirmation, idempotency, and Audit History. Direct uncontrolled inserts are prohibited.

## Environment and visibility strategy

The MVP uses three boundaries:

- **Local:** development against local PostgreSQL and deterministic synthetic data.
- **Preview:** reviewable PR deployments using synthetic or anonymized resources isolated from Production. Runtime-changing PRs receive a Preview; documentation-only PRs require CI but no application environment.
- **Production:** official resources and data. Before launch, public discovery and the official domain remain disabled while the Admin enters and validates initial data.

A permanent shared Staging environment is deferred to control cost and operational work. Add it when federation acceptance requires a stable shared boundary, multiple developers or Admins need coordinated testing, or migrations/imports become too risky to rehearse with Preview and private pre-launch Production. Production personal data, secrets, private files, and webhooks never enter Local or Preview.

Unfinished modules are absent from navigation and inaccessible rather than presented as empty or “coming soon.” Simple server-side configuration may control deployment visibility; Draft, Private, and Public remain domain states rather than technical feature flags. Demo deployments use synthetic data and `noindex` and are never described as the official federation source.

## Verification and release gates

The canonical scenario catalogue, four promotion gates, CI job boundaries, performance budgets, evidence policy, and launch procedure are defined in [the end-to-end acceptance blueprint](./end-to-end-acceptance.md).

Every milestone must leave `develop` deployable and pass the applicable subset of:

- lint, type check, unit tests, and production build;
- empty-database migration and previous-release upgrade;
- real-PostgreSQL repository, constraint, transaction, lock, and outbox tests;
- authentication, authorization, Audit History, and idempotency tests;
- browser happy paths and critical failure paths;
- automated accessibility checks plus manual keyboard checks for critical flows;
- server-rendered Published content, cache invalidation, privacy removal, and degraded dependency behavior;
- checks that fixtures, logs, and Preview resources contain no Production secret or personal data;
- migration rollback compatibility and forward-recovery evidence.

The developer owns technical evidence. The federation representative or acting Admin owns validation of regulations, schedules, standings, content, and administrative usability. Official launch requires both; before federation participation, domain acceptance is explicitly recorded as internal.

## Rollback and recovery checkpoints

- Tag the final prototype and meaningful release candidates.
- Keep each PR independently reviewable and reversible.
- Prefer additive schema, backfill, application switch, verification, and later cleanup.
- Never edit an applied shared migration or depend on destructive down migrations.
- Take and verify a fresh recovery point before high-risk data changes.
- Preserve official decisions and correct them through versioned rulings or revisions rather than database restoration, except during a declared recovery incident.

## Workstream and issue policy

Track each milestone with a parent issue and each vertical slice with a small issue or tightly related issue group. Every implementation issue states scope, dependencies, acceptance criteria, tests, and `Out of scope`. Avoid both module-sized “implement everything” tickets and file-by-file tickets.

The available streams are Editorial/Public Media, Sporting Workflows, and Operations/Testing/Deployment. With one developer, limit work in progress to one primary slice plus one small infrastructure or testing task.
