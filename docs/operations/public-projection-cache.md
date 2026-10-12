# Public projection cache (M3 / #94)

## Scope and flow

Home, Competition and Season pages use cached, server-only Published projections. A Season
snapshot contains its public navigation, entries, schedule and provisional standings. Private
and Admin data, ORM objects and credentials are never stored in this shared cache.

Each request first reads the current public visibility and technical source revision. The
request-time sentinel is not shared-cache data. A matching cache key reuses the projection;
a changed revision loads a new read-only `REPEATABLE READ` snapshot. Revision and payload
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
  Full post-commit outbox delivery belongs to M4; versioned reads already bypass an older source
  revision without relying on that future delivery path.
- A separate bounded last-verified public response supports database outage handling: at most
  128 entries, 1 MiB serialized per entry, 8 MiB serialized total. These are serialized-size
  limits, not a claim about exact heap usage.
- Fallback is allowed for less than 5 minutes after the last successful authoritative check.
  Failed checks never renew it. It is labelled with a visible, accessible freshness warning.
- A confirmed new revision, redirect, missing/private route or incompatible Season date discards
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
