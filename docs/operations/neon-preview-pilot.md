# Isolated Neon / Render PR Preview pilot (#95)

## Scope and trust anchor

This is one manually provisioned pilot, not automatic per-PR database orchestration.
Use only the Preview-only Neon project `proleague-preview` (`long-sea-15202409`) in
AWS Frankfurt, PostgreSQL 18, Free organization `ProLeague`.
The root `preview-empty` (`br-divine-leaf-b90tlpj2`) must stay empty. A read-only check
on 2026-10-14 found zero user relations and no `app` schema in its `neondb` database.
Never migrate, seed or attach this parent to Render. Never copy Development/Production data.

The non-secret trust anchor is in `src/server/db/preview-target.ts`. Credentials are not
stored there. Changes to the anchor require review, not an environment-variable override.
An operator verifies Neon control-plane metadata before any migration or seed connection.
Runtime uses the exact operator-verified binding without keeping a Neon API key or making
control-plane calls on page requests. This protects accidental wrong configuration, not a
malicious operator who can change both credentials and the verified binding.

## 1. Prepare the PR branch (after local review)

1. Review and push the runtime-changing feature branch; open its PR into `develop`.
2. Record the actual PR number and head SHA. Do not guess the next PR number.
3. Verify `preview-empty` is still empty, then create its normal child `pr-<number>`.
   Configure a small compute and automatic suspension without changing the plan.
4. On that child only, create `proleague_golden_seed_pr_<number>`. Do not reuse `neondb`.
5. Record the project, parent, child branch and endpoint IDs and the direct endpoint hostname.
   Give the branch a short expiry where supported. Regardless of expiry, cleanup after PR
   closure is required. Reuse the branch for a redeploy of the same PR; do not silently reset it.
6. If migration/seed preparation is irrecoverable, stop and explicitly agree replacement of
   that PR branch. Never reset another target or silently modify the binding to a different parent.

The binding has this shape (the child/endpoint values below are placeholders):

```json
{
  "projectId": "long-sea-15202409",
  "parentBranchId": "br-divine-leaf-b90tlpj2",
  "branchId": "br-actual-pr-child",
  "endpointId": "ep-actual-pr-child",
  "directHost": "ep-actual-pr-child.c-7.eu-central-1.aws.neon.tech",
  "pullRequest": 105,
  "database": "proleague_golden_seed_pr_105"
}
```

`105` is an example, not an allocated PR. Set `PREVIEW_DATABASE_IDENTITY` to the compact JSON
for the actual PR in the operator session and, later, that individual Render Service Preview.
Do not add the binding or credentials to the base Development service or a shared env group.

## 2. Explicit migrations, seed and verification

Use direct owner credentials of the isolated child as `MIGRATION_DATABASE_URL` and
`SEED_DATABASE_URL`; runtime uses a separate read-only login and pooled URL.
Require `sslmode=verify-full`, replacing `sslmode=require` in the copied URL if present.
Optional `channel_binding=require` is supported; URL host/options overrides are rejected.

Load secrets privately, without putting their literal values in shell history. For example,
PowerShell 7 supports masked input:

```powershell
$env:NEON_API_KEY = Read-Host 'Preview-scoped Neon API key' -MaskInput
$env:MIGRATION_DATABASE_URL = (Read-Host 'Direct PR database URL' -MaskInput).Replace('sslmode=require', 'sslmode=verify-full')
$env:SEED_DATABASE_URL = $env:MIGRATION_DATABASE_URL
# Set PREVIEW_DATABASE_IDENTITY to the non-secret, actual PR binding above.

# Replace N everywhere with the actual PR number before running.
pnpm db:migrate:preview --preview-pr=N --confirm-db=proleague_golden_seed_pr_N
pnpm db:seed-golden --target=preview --preview-pr=N --confirm-db=proleague_golden_seed_pr_N
pnpm db:verify-golden --target=preview --preview-pr=N --confirm-db=proleague_golden_seed_pr_N
```

The commands check project/region/PostgreSQL version, child name and parent, endpoint ownership,
exact host/database and SQL database identity. Provider verification failure stops before SQL.
The migration runner holds one direct session advisory lock, sets timeouts, validates the existing
ledger prefix, applies only committed Drizzle migrations and verifies all hashes/timestamps.
Local migration protection is unchanged. Startup and requests never run migrations.

Seed refuses populated data and remote `--reset` is disabled. Successful Golden verification
must report relationship digest
`356709a5a2fd1b8d430751f3d00a1e071d85f742d05f730cc0caec9cadc9c961`.

## 3. Read-only runtime identity

Select a private random 32–128 character base64url password, keep it in your private credential
store, and provide it through masked input. Do not use an owner URL in Render.

```powershell
$env:PREVIEW_RUNTIME_PASSWORD = Read-Host 'Private random Preview reader password' -MaskInput
pnpm db:prepare-preview-reader --preview-pr=N --confirm-db=proleague_golden_seed_pr_N
```

This creates `preview_reader_pr_N` on the child only, with LOGIN but no superuser, role creation,
database creation, replication or RLS bypass. It grants SELECT only on the M3 query tables,
not the migration ledger, Admin/personal-data tables or write privileges. Existing role names
are refused instead of silently rotating passwords. SQL ownership stays with the operator.

Construct the pooled URL for that login and that database, using the verified endpoint's
`-pooler` hostname, its private password and `sslmode=verify-full`. Enable the child endpoint's
pooler if it is not yet enabled, then validate the login before injecting it into Render.
Do not enable services such as Auth, Functions, Object Storage or AI Gateway for this pilot.

## 4. Configure the individual Render Service Preview

Use the actual Preview `pro-league-development-pr-N`, never the base service.
Before changing env, confirm its service ID, PR number and source commit. Preserve existing
non-secret env keys. Add only:

- `DATABASE_URL`: the PR-specific pooled reader URL;
- `PREVIEW_DATABASE_IDENTITY`: the verified non-secret binding.

Render supplies `IS_PULL_REQUEST=true`, `RENDER_EXTERNAL_HOSTNAME` and `RENDER_EXTERNAL_URL`.
Runtime matches those against the PR binding; missing, malformed, parent, wrong-host, wrong-db,
wrong-login or unsafe-TLS configuration cannot serve data or use the last-verified fallback.
Before injection, the Preview may display the unavailable state; that is expected, not evidence
that the pilot works. The service health response alone is not database readiness evidence.

Rebuild/redeploy the Preview after configuration, then verify its head SHA. Never upload
`NEON_API_KEY`, owner/migration/seed URLs or the separate password variable to Render.

## 5. Evidence

Warm the route once if the free service was suspended. Run:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'https://pro-league-development-pr-N.onrender.com'
$env:PUBLIC_PREVIEW_SMOKE = '1'
pnpm exec playwright test tests/e2e/public-preview.spec.ts --project=chromium --project=chromium-mobile
```

Record PR/head SHA, Render service ID and URL, Neon child/endpoint IDs, migration verification,
Golden digest, database-to-server-HTML smoke results and `X-Robots-Tag: noindex`.
Home, Competition and Season also show a visible synthetic Preview notice and robots metadata.
Existing CI/Preview Lighthouse budgets remain required. Additional mobile Competition/Season
measurements stay diagnostic until UI stabilization, as agreed for #94; do not describe them as passing.

Local/CI negative verification needs no Neon secrets or database:

```powershell
pnpm build
$env:PUBLIC_PREVIEW_GUARD_FIXTURE = '1'
pnpm exec playwright test tests/e2e/public-preview-guard.spec.ts --project=chromium --project=chromium-mobile --workers=1
Remove-Item Env:PUBLIC_PREVIEW_GUARD_FIXTURE
```

It starts its own production servers and checks unavailable/noindex/notice with zero connections
to a loopback database trap. No production test bypass or fixture HTTP route is added.

## 6. Cleanup and failure handling

After PR merge/closure, verify Render automatic removal within 30 minutes. Separately inspect
the matching Neon child identity and delete only that child after confirming no review is pending.
Keep `preview-empty` and the Preview-only project for subsequent pilots. Confirm child removal
in Neon; do not assume Render cleanup also deletes Neon branches.

If cleanup fails, stop new allocations, alert the Technical Operator and record an operations
issue with non-secret IDs and timestamps. No automatic deletion is implemented by #95.
Remove operator-session `NEON_API_KEY`, `MIGRATION_DATABASE_URL`, `SEED_DATABASE_URL`,
`PREVIEW_DATABASE_IDENTITY`, `PREVIEW_RUNTIME_PASSWORD`, `PLAYWRIGHT_BASE_URL` and
`PUBLIC_PREVIEW_SMOKE` when done. Restore any pre-existing values if this session reused them.

## Status

Local implementation verification: quality, TypeScript and production build passed; all 98
unit tests passed with two workers. The first unrestricted unit run had worker startup timeouts,
and the first build hit a transient Google Fonts fetch failure; their successful reruns did not
change test assertions, fonts or budgets. Desktop and mobile isolation browser tests passed,
including zero SQL connections for missing/mismatched Preview bindings.
The additional local Golden verifier initially could not connect to `127.0.0.1:5434`
(ECONNREFUSED). On 2026-10-18, the user started the container and confirmed that verification
passed with the expected relationship digest above. No local seed/reset was performed by the agent.

The project/empty-parent read-only preflight is verified. The PR child, remote migration/seed,
read-only login, Render binding, successful deployed smoke and cleanup evidence remain pending
until the implementation is reviewed and an actual PR number exists. Do not close #95 on local
test results alone.

References: [Neon pooling](https://neon.com/docs/connect/connection-pooling),
[Render Service Previews](https://render.com/docs/service-previews), ADR-0023 and ADR-0026.
