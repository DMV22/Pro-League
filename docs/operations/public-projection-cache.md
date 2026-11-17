# Public projection cache (M3 / #94)

## Scope and flow

Home, Competition and Season pages use cached, server-only Published projections. A Season
snapshot contains its public navigation, entries, schedule and provisional standings. Private
and Admin data, ORM objects and credentials are never stored in this shared cache.

Each request first reads the current public visibility, technical source revision and confirmed
cache-generation vector. The
request-time sentinel is not shared-cache data. A matching cache key reuses the projection;
a changed revision or generation loads a new read-only `REPEATABLE READ` snapshot. Identity and payload
come from the same snapshot. A race retries once, then fails safely rather than publishing
an inconsistent result. Metadata and page content deduplicate within the request.

`public_projection_revisions` is technical metadata, not editable official sporting data.
Reviewed database triggers maintain portal, Competition and Season clocks transactionally.
They cover Competition/Season/Team roots, Season Entries, current Stage roots, Fixture Rounds,
League Fixture Slots, Matches, current Stage participant slots, ranking rules, Points Schemes,
Tie-breakers and Standing Adjustments. Immutable result/schedule/assignment revisions become
public through their current owner pointers; inserting an unpublished replacement alone does
not publish it. Runtime cannot directly insert/update these clocks or call their definer functions.

Bootstrap clocks derive from existing committed sources. Further relevant source changes use
transactional stored timestamps, including direct SQL updates without an `updated_at` assignment.
Rollback undoes the source clock too. Season sporting calculations additionally include the
Season-local civil date in the cache key: an adjustment can become effective without a DB write.

## Cache and fallback policy

- `publicSporting`: server revalidate 60 seconds, expire 300 seconds, requested client stale 0.
  Revalidation is triggered by a later request, not a scheduled timer. Next's client router has
  its own minimum reuse behavior; request-time verification applies when a request reaches the server.
- Versioned semantic tags: portal, Competition, Season, Season schedule and Season Standings.
  M4 ordinary post-commit delivery uses a durable generation per target; versioned reads also
  bypass an older source revision independently of delivery.
- A separate bounded last-verified public response supports database outage handling: at most
  128 entries, 1 MiB serialized per entry, 8 MiB serialized total. These are serialized-size
  limits, not a claim about exact heap usage.
- Fallback is allowed for less than 5 minutes after the last successful authoritative check.
  Failed checks never renew it. It is labelled with a visible, accessible freshness warning.
- A confirmed new revision/generation, redirect, missing/private route or incompatible Season date discards
  the old fallback. A late in-flight response cannot repopulate a subsequently discarded entry.
- Cold, expired, evicted or restarted cache + unavailable DB shows an accessible unavailable state.
  Only connectivity/resource-timeout failures permit fallback; schema and programming errors do not.
- `lastUpdatedAt` comes from committed source metadata. It is not the render/fallback clock.

This is the agreed bounded compromise for current public sporting text. During DB outage the
latest visibility change cannot be independently confirmed. Player personal data and Urgent
Purge are outside this fallback and require the separate fail-closed/purge workflow before release.

The default Next cache and fallback are disposable single-process memory. Restart/deployment
loses them. Redis, multiple instances and durable fallback are not introduced by #94.
All runtime queries now have a 5-second PostgreSQL statement timeout and 6-second client
read timeout, with the existing 5-second connection/acquisition bound.

## Local verification

The implementation session applied `0002_public_projection_revisions` only to the disposable
local Golden and empty integration databases. For another database, explicitly set its correct
local `MIGRATION_DATABASE_URL` and run `pnpm db:migrate:local`; do not reset data for this migration.

```powershell
pnpm quality
pnpm types
pnpm unit
pnpm db:verify-golden --target=local --confirm-db=proleague_golden_seed
pnpm build
pnpm start:golden
```

Inspect `/`, `/competitions/golden-cup`, and `/competitions/golden-cup/seasons/2026-golden`.
Published data should have a source-based “Оновлено” value, not a new value on every reload.

The normal seeded browser checks use `PUBLIC_NAVIGATION_TEST_FIXTURE=1` and the running
Golden server's `PLAYWRIGHT_BASE_URL`. The dedicated degradation test uses its own Next
server and local TCP proxy; no production test Route Handler is installed:

```powershell
# DATABASE_URL must point to migrated proleague_public_cache_local, NOT Golden/app data.
$env:PUBLIC_CACHE_BROWSER_FIXTURE = '1'
pnpm exec playwright test tests/e2e/public-cache.spec.ts --project=chromium --project=chromium-mobile --workers=1
Remove-Item Env:PUBLIC_CACHE_BROWSER_FIXTURE
```

Create and migrate the separate local `proleague_public_cache_local` database before this suite;
CI creates and migrates `proleague_public_cache_ci` automatically. The helper refuses Golden,
application and production database names. This suite creates four clearly synthetic scenario-owned
records in that dedicated database, then hides them during cleanup. Immutable slug history is
preserved; no Golden Season record or inventory is modified. Do not use shared acceptance data.
CI runs it separately, serially, after ordinary navigation checks to avoid fixture interference.

`pnpm db:verify-public-cache` uses a local `DATABASE_URL` and rollback-only synthetic changes.
The integration suite also checks current Result replacement and private participants; migration
CI rehearses the previous release's populated schema and compares it with a clean install.
The exact 5-minute expiry is verified with an injected clock, not a five-minute browser sleep.

Manual NVDA/screen-reader validation and deployed Render/Neon performance remain follow-up
verification; automated axe results are not a claim of full WCAG conformance.

## Ordinary post-commit invalidation (M4 / #133)

The transactional Outbox accepts versioned `public.cache.invalidate` intents through
`cacheInvalidationIntent()`. Targets are typed Portal, Competition, Season, schedule or
standings identifiers, not arbitrary Next.js tag strings. The adapter verifies the exact
committed source revision and records both queue work and its durable invalidation intent
inside the caller's transaction. Rollback removes both. Urgent Purge is explicitly rejected.

Same-target/revision enqueues coalesce into one canonical message. Persisted message IDs
cannot be reused for different content. Discarded noncanonical input IDs are not durable
reservations; dispatch and recovery use the returned stored canonical work, not those aliases.
Confirmed revisions coalesce older work for the same target, never across independent clocks.

Confirmation changes the ordered vector of highest confirmed watermarks used in public cache
keys. A Season includes Competition, Season, schedule and standings targets. Reads compare
source revision, generation and Season civil date both before loading and inside snapshot
assembly. `revalidateTag` is best-effort reclamation, **not** the confirmation barrier: Next
flushes it after the handler returns. New server reads use the confirmed generation even if
tag reclamation fails. Keep the highest confirmed watermark for every target during any
future retention work; deleting it could resurrect an older cache key. Application roles
cannot delete these records. No retention/reset operation is introduced here.

`POST /api/operations/cache-invalidation` is a machine-only, bounded dispatch entry:

- Disabled (`503`) unless `CACHE_INVALIDATION_KEY` is exactly 64 hexadecimal characters.
- Requires `Authorization: Bearer <key>` (`401` otherwise); use a separate random secret,
  never a Clerk/API key. Do not expose it through a `NEXT_PUBLIC_` variable.
- Accepts an empty POST only; query parameters or payloads return `400`. Caller-supplied
  targets, limits and lease tokens are never accepted.
- Uses only `OUTBOX_DATABASE_URL`, with a separately provisioned least-privilege worker
  login inheriting `app_worker`. Never use the migration/owner URL. Remote TLS requires
  `sslmode=verify-full`; existing Preview identity guards still apply.
- Consumes this message type only: at most 20 candidates and a 10-second run budget,
  plus bounded database timeout/settlement grace. No unbounded queue drain.
- Returns private/no-store/noindex JSON counters. HTTP `200` means the batch completed,
  not that every candidate succeeded; inspect retry/failed/exhausted counters too.

Neither the key, worker login nor a Render scheduler is provisioned/activated by this change.
Timely automatic dispatch and its deployed pilot remain a separately approved rollout step.
The standalone Node dispatcher does not import `next/cache` or claim this handler's work.

Pending work within 60 seconds is not a content-staleness warning. Failed, exhausted or older
unconfirmed work produces the separate accessible “Оновлення кешу затримується” notice.
Source/snapshot matching still determines content freshness; confirmation does not advance
domain/source revisions. There is no browser push or physical HTML/CDN/media purge guarantee.

Verification on dedicated disposable local databases only:

```powershell
# INTEGRATION_DATABASE_URL must be the guarded disposable integration database.
node --conditions=react-server --import tsx scripts/db/verify-cache-invalidation.ts --target=ci --confirm-db=proleague_integration_ci
# DATABASE_URL must be migrated proleague_public_cache_local, never normal app/Golden data.
pnpm build
$env:CACHE_INVALIDATION_BROWSER_FIXTURE = '1'
pnpm exec playwright test tests/e2e/cache-invalidation.spec.ts --project=chromium --project=chromium-mobile --workers=1
Remove-Item Env:CACHE_INVALIDATION_BROWSER_FIXTURE
```

The browser suite creates ephemeral worker/runtime logins and hides its synthetic Competition
afterward, retaining immutable slug history. Its owner-only synthetic source-clock freeze is
a test technique proving generation-based refresh; no application bypass is installed.

The browser runtime login uses the same public-table allowlist and cache-evidence column
grants as the restricted Preview reader, not `app_runtime` membership. It also verifies that
Outbox payload/lease fields, Audit, private player data, the migration ledger and cache writes
are denied, and that unexpected extra grants make provisioning fail closed. This covers the
#143 cloud regression: the older Preview allowlist lacked permissions for the new cache
state query (`42501`). Both provisioning paths now use the same narrowly scoped policy.
See [the trusted-controller rollout note](isolated-preview-automation.md#activation-prerequisites--operator-actions-not-performed-by-local-code)
before repeating cloud acceptance; local correction alone does not update the deployed reader.

### Local implementation evidence (2026-11-17)

- All 258 unit tests passed; TypeScript and production build passed.
- PostgreSQL 18 full integration passed. Focused Outbox/cache scenarios additionally passed
  after introducing common same-ID serialization: rollback, concurrent semantic coalescing,
  conflicting persisted ID, newer-before-older delivery, confirmation retry/exhaustion,
  failed tag cleanup with successful logical invalidation, and message-type scope.
- Rollback-only source-clock tests passed for Season generation/Competition tag coverage,
  independent revision domains and unrelated-target isolation.
- Desktop/mobile ordinary invalidation browser tests passed (2); existing warm-outage,
  cold-restart and hidden-content cache regressions passed (2); shell/navigation/axe passed (16).
- Changed-code ESLint and Prettier checks passed. The broad `pnpm quality` invocation was
  stopped because ESLint descended into pre-existing ignored local browser artifacts;
  those artifacts and the lint configuration were not changed by this work.
- No cloud pilot, scheduler activation, real Clerk session or new Lighthouse measurement is
  claimed by this local evidence. CI and owner review/merge remain required.

## Implementation-session evidence (2026-10-13)

- Quality, TypeScript, production build and all 79 unit tests passed.
- PostgreSQL 18 integration, populated previous-release upgrade, and clean/upgrade schema
  equality passed. The Golden inventory and stable relationship digest passed after browser tests.
- Fourteen ordinary desktop/mobile navigation, server-HTML and axe checks passed. The separate
  cache browser suite passed on both form factors, including warm outage warning, cold restart,
  source refresh and confirmed hiding. Test-only fixtures now use only their dedicated database.
- Extra mobile Lighthouse verification of the Season URL is **not passing**. In three isolated
  production navigations the median Performance score was 81 (78–85), LCP 2814 ms (2755–2977),
  and TBT 571 ms (443–600), against unchanged targets of 90, 2500 ms and 200 ms.
- Reported server-response timing was 8–13 ms. The Lighthouse trace attributes substantial work
  to script execution and layout; this does not establish a cache/DB bottleneck or a regression
  relative to develop (no equivalent before measurement was collected). Field data is unavailable.

## Agreed Performance scope (2026-10-13)

The user approved treating additional mobile Lighthouse measurements of Competition and Season
as diagnostic baselines, not blockers for #94, while the public UI remains provisional.
Existing required CI checks and their strict budgets are unchanged; a failing required check
still blocks acceptance. Functional and cache-degradation criteria remain required for #94.

The supplied Lighthouse 13.4.1 reports measured Competition at Performance 77, LCP 2803 ms,
TBT 798 ms, and Season at Performance 86, LCP 2802 ms, TBT 413 ms; CLS was 0 on both.
These are one run per route, not a repeat-run median or proof of a regression. They are not
directly comparable with the Lighthouse 12.6.1 implementation-session measurements above.

After the public UI stabilizes, and before its release, repeat equivalent mobile measurements
and resolve failures against the unchanged targets. Compare with develop using the same tool
version and conditions, then use focused traces to guide client/runtime and layout optimization.
Do not interpret this deferral or functional completion as a passed mobile Performance budget.
