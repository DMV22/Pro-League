# Isolated PR Preview automation

Issue: [#96](https://github.com/DMV22/Pro-League/issues/96).
This replaces the manual lifecycle from [the Neon pilot](neon-preview-pilot.md),
not its isolation guarantees. Local implementation is not proof of cloud acceptance.

## Trust model and lifecycle

- Only same-repository PRs targeting `develop` qualify. Forks and PRs targeting
  `main` do not receive resources. Documentation, tests, agent configuration and
  controller-only changes do not allocate a Preview.
- `preview-lifecycle.yml` runs trusted controller code from the immutable
  `github.workflow_sha` of its **main-branch workflow**. It never checks out,
  imports or installs the PR application in a credential-bearing job.
- The controller checks GitHub Environment protections and waits for successful
  `pr-baseline.yml` CI associated with the exact PR head SHA before preparation.
  A baseline failure or a ten-minute wait timeout blocks preparation. After CI
  succeeds, an operator may rerun the controller using workflow dispatch.
- Only bounded regular SQL, migration journal and snapshot blobs are fetched
  from the PR's immutable Git tree. Git object hashes, manifest structure and
  the whole bundle digest are checked. Unrecognized bundles require the
  `preview-migrations` reviewer gate, bound to that PR SHA and digest. An
  approval does not authorize future changed SQL or a new PR's changed bundle.
- A signed bot comment records reservation, identity, applied migration digest,
  deployment and phase. The Neon branch receives a signed ownership annotation
  at creation, allowing recovery after an interrupted POST. Neither record
  contains a password or API key. Do not edit, copy or delete these records.
- The pinned empty Neon parent is checked through provider metadata and a
  read-only SQL inventory. A session advisory lock serializes allocation; no
  schema or application data is written to the parent. At most **two** child
  branches are allowed. A third PR fails visibly without evicting either one.
- Each PR gets `pr-N`, database `proleague_golden_seed_pr_N`, reviewed Drizzle
  migrations and the trusted synthetic Golden fixture. Existing fixture fields
  and all application-table counts are checked before reuse. Mismatch stops the
  operation; there is no implicit reset, imported Production data or fallback.
- The reader login has only the current public-projection SELECT allowlist.
  Its stable per-branch password is derived from the private state key. Only
  its pooled URL and non-secret identity are set on the **validated matching**
  Render Preview. Parent service, owner, repository, branch, URL and existing
  binding must match before mutation. Auto-deploy is disabled on that Preview,
  and the controller requests deployment of the exact checked SHA.
- A live deploy is not readiness. Credential-free subprocesses check server HTML,
  Golden content, noindex and desktop/mobile browser behavior, then run the
  unchanged Lighthouse budgets. `isolated-preview` becomes successful only
  after these checks and a final deployment-SHA check.
- Mutations and cleanup share a queued cross-PR concurrency group. Work is not
  canceled halfway through a mutation. Current PR state/SHA is rechecked between
  stages; a changed revision cannot be marked ready by an obsolete run.

## Activation prerequisites — operator actions, not performed by local code

1. Review this implementation on its feature branch. Do **not** merge all of
   `develop` into `main` to activate it.
2. Create the separately reviewed minimal bootstrap PR into default branch
   `main`. Its runtime file set is:

   - `.github/workflows/preview-lifecycle.yml`
   - `.github/workflows/preview-reconcile.yml`
   - `.github/workflows/render-blueprint.yml` (credential-free validation)
   - `.github/workflows/pr-baseline.yml` (adapt only the standalone install steps to main's applicable jobs)
   - `scripts/preview/` excluding `*.test.ts`, `node_modules`, reports and artifacts
   - `scripts/db/golden-season-fixture.ts`
   - `scripts/db/migration-ledger.ts`
   - `scripts/db/preview-preflight.ts`
   - `src/server/db/preview-target.ts`
   - `lighthouserc.cjs`

   The standalone `scripts/preview/package.json` and npm lockfile deliberately
   avoid upgrading the old main-branch application or installing its root
   dependencies. Install with `npm ci --prefix scripts/preview --ignore-scripts`.
   Preserve main's existing baseline structure: do not replace it wholesale with
   develop's database/browser jobs or pull unrelated application files into the
   bootstrap. Apply the dependency-install prerequisite only where main's checks
   consume the controller sources, then verify the bootstrap PR's own CI.
   This is a controller bootstrap, **not** a Production application deployment.
   Confirm main-branch deployment filters before merging it.
3. Create GitHub Environments with **Selected branches and tags → branch `main`
   only**, no tags or wildcard rule:

   | Environment | Secrets | Variables | Protection |
   | --- | --- | --- | --- |
   | `preview-control` | `PREVIEW_STATE_KEY`, Preview-only `NEON_API_KEY`, `RENDER_API_KEY` | `RENDER_BASE_SERVICE_ID`, `RENDER_OWNER_ID` | main only |
   | `preview-migrations` | the **same** `PREVIEW_STATE_KEY` | none | main only + required reviewer |

   Use a cryptographically random 32-byte key represented by 64 hex characters.
   Store it privately; never in a repository file, workflow output, PR comment,
   screenshot, artifact or Render environment. Do not rotate this key while
   live resources exist: it verifies ownership and derives reader credentials.
   First clean and verify all owned resources, then change both Environment
   copies together. A lost key requires manual identity verification and cleanup;
   the controller must not silently adopt existing resources.

   Pin IDs from the actual Development service and its owner, not from a service
   display name. Neon project/parent identity remains pinned in
   `src/server/db/preview-target.ts`. Never substitute a Production project.
4. Audit repository/organization secrets and inherited Render env groups. Provider
   keys must not be accessible to a job that runs PR code. The updated
   `render-blueprint.yml` validates against a checked-in snapshot of the official
   Render JSON Schema using locked dependencies, without a Render API key or
   workspace. This is structural validation, not a check of live resource
   existence, permissions, quota or immutable-field changes.

   First merge the credential-free workflow and its validation dependencies into
   both active base branches (`main` via the reviewed bootstrap, `develop` via
   the feature PR). Configure the new Preview-only key exclusively in the
   main-restricted Environment, check no other workflow needs the old key, then
   **remove the repository-level `RENDER_API_KEY` and revoke its old provider
   token**. Merely removing the workflow reference does not make a remaining
   repository secret unavailable to PR code. Do not reuse the old key for the
   controller. Secret deletion/revocation is a separate operator action; local
   implementation does not perform it or prove this security precondition.

   Render base/shared environments must contain neither provider/owner credentials
   nor a shared `DATABASE_URL`/`PREVIEW_DATABASE_IDENTITY` for PRs to inherit.
5. Permit **only the reviewed trusted** `pull_request_target` controller in the
   repository's applicable Actions policy. Do not broadly disable security rules.
   Inspect actual `github.workflow_ref`/Environment branch behavior in bootstrap:
   the controller requires the approved workflow path at `refs/heads/main` and
   fails closed otherwise. Do not loosen this check to make a failed pilot pass.
6. Apply `render.yaml`'s **Manual** Preview generation to the Development service.
   Also apply its build command, which installs both locked dependency sets before
   `pnpm build`: `pnpm install --frozen-lockfile && npm ci --prefix scripts/preview --ignore-scripts --no-audit --no-fund && pnpm build`.
   Next.js type-checks the controller sources too, so a root-only install fails
   even when the application compiles. CI already installs both dependency sets.
   Verify the actual build command on existing PR Previews separately; a local
   Blueprint edit does not update an already-created service. Keep this command
   aligned with the Blueprint when applying an override to an existing Preview.
   The controller, not each developer, owns the `render-preview` label. The
   initial unbound Preview may start before binding, but is never readiness
   evidence. Do not add database credentials to the base service to fix it.
7. Apply the feature-branch `preview-lighthouse.yml` change: automatic acceptance
   now runs inside the trusted controller **after binding**, not on the first
   `deployment_status`. The old workflow remains a manual diagnostic. Configure
   `isolated-preview` as the PR readiness status after the live pilot; preserve
   the existing baseline checks and Lighthouse thresholds.

## Lifecycle operations

Ordinary runtime PR open/update: no console commands or per-PR credentials.
Inspect → exact migration approval if needed → reserve/reuse → migrate and
verify → bind and deploy → smoke/Lighthouse → success. The controller updates one
signed PR comment rather than creating a comment on each retry.

On a transient failure, inspect the failed Actions stage. GET/PUT/DELETE have
bounded retries for transport errors and transient HTTP status codes; POST/PATCH
are not blindly repeated. An explicit repeat first resolves signed existing
resources. A failed preparation retains them for diagnosis and never reports
readiness based on the previous deployment.

TTL is **seven days from reservation**, rounded to seconds; pushes and retries
do not extend it. Closing/merging cleans the corresponding validated Render
Preview and Neon branch. Daily reconciliation runs at **03:23 UTC** and also
cleans expired live PR resources. Neon expiry is an independent safety net.
An expired/cleaned PR cannot silently allocate again. After confirmed cleanup,
an operator can dispatch **Isolated Preview**, choose the PR number and
`operation: recreate`. It creates a new seven-day reservation, never resets an
existing database, and is still subject to CI, migration approval and capacity.

Cleanup failures create a deduplicated GitHub issue; unknown resource inventories
create a separate deduplicated issue. These alerts block preparation until
resolved. Confirm ownership, current PR state and provider deletion before closing
an alert. Never delete the empty parent or an unidentified branch/service.
Daily reconciliation can also be dispatched manually after a provider outage.

## Verification and completion evidence

The root TypeScript project includes `scripts/preview`, and root unit tests
discover its tests. Installing only the root pnpm lockfile does not install the
standalone package's Ajv/YAML dependencies. Every baseline job that runs types,
unit tests or a Next.js build therefore installs `scripts/preview/package-lock.json`
with `npm ci --ignore-scripts` first. This includes browser/Lighthouse jobs and
the PostgreSQL integration job, because they build the application too. Each job
has its own runner; installation in the separate Blueprint job does not carry
over. Documentation-only PostgreSQL jobs retain their existing skip behavior.

Local checks:

```powershell
npm ci --prefix scripts/preview --ignore-scripts --no-audit --no-fund
npm --prefix scripts/preview run blueprint:validate
pnpm exec vitest run scripts/preview
pnpm quality
pnpm types
pnpm unit
pnpm build
```

Blueprint validation requires no `.env.local`, cloud credentials, network access
after dependency installation, or provisioned Render resources. The pinned schema
and update procedure are documented in `scripts/preview/schemas/README.md`.

Do not invoke `cli.ts` locally with cloud keys: it requires a trusted Actions
workflow context. Tests substitute only external provider systems and exercise
policy/reconciliation/cleanup and provider HTTP contracts. Passing these tests
does not prove the Render API's live Preview identity shape or provider setup.

Before closing #96, attach live Actions/PR evidence for:

1. Two simultaneous eligible runtime PRs with distinct branch, endpoint,
   database, reader role and matching Render binding; successful server/browser
   smoke and strict Lighthouse for each SHA.
2. A repeated run/update reusing its identity without extending TTL; an approved
   new SQL bundle tied to the exact SHA, and changed SQL/SHA refusing stale approval.
3. A docs-only PR with no label, child branch or Render Preview; fork/main-target
   exclusion; a third runtime PR blocked without altering the first two.
4. A partial failure remaining blocked, followed by safe repeat; no secrets in
   logs, comment or artifacts and no provider/owner credentials in PR runtime.
5. Close/merge deleting only each PR's resources; repeated cleanup remaining safe;
   reconciliation/expiry, explicit recreation and actionable deduplicated alerts.

Keep additional mobile Competition/Season Performance diagnostic for the current
temporary UI. This does not waive the existing required Lighthouse budgets.
