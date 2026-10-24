# Preview controller bootstrap into main

Part of [issue #96](https://github.com/DMV22/Pro-League/issues/96).
Completed expiry/alert/recreation evidence is recorded in
[the issue #96 acceptance report](https://github.com/DMV22/Pro-League/issues/96#issuecomment-6374813431).
Controller source: reviewed `develop` commit
`2db72014129040e46e43a99ef8efdfaa7b2f1b0d` (PR #104).

## Scope

This branch starts from `main`, not `develop`. It adds only the standalone
controller, its workflows and missing shared Preview database guards. The Golden
fixture, migration ledger and Lighthouse configuration already match the reviewed
source. The existing main baseline keeps its jobs and gains dependency installation
only where types, tests or application builds consume controller sources.

No application pages, schema migrations, root dependency upgrades or Render
service changes are part of this bootstrap. Existing controller tests remain on
develop; the bootstrap copies runtime files without their `*.test.ts` files.
Blueprint validation is credential-free. Permanent lifecycle/alert and workflow
regression tests now also live on `main` after the temporary acceptance drill.

## Before merging this bootstrap PR into main

1. Create `preview-control` and `preview-migrations` GitHub Environments. Restrict
   each to exactly the branch `main`, with no tag or wildcard policies. Require a
   reviewer for `preview-migrations`. Do this before merging scheduled workflows;
   do not rely on GitHub's automatic creation of an unprotected Environment.
2. Generate and privately retain one 32-byte random `PREVIEW_STATE_KEY`, encoded
   as 64 hex characters. Set the same value in both Environments. Never place it
   in a PR, screenshot, command output, repository file or Render runtime.
3. Put new Preview-only `NEON_API_KEY` and `RENDER_API_KEY` secrets exclusively in
   `preview-control`. Set Environment variables `RENDER_BASE_SERVICE_ID` and
   `RENDER_OWNER_ID` from the verified Development service and workspace.
4. Check deployment integrations and filters for `main`. This is not authorization
   to deploy Production or promote develop's application into main.
5. Require successful bootstrap CI and review the trusted workflow code. Do not
   grant keys to untrusted PR code or relax trust checks to get a green run.

## After merge, before the first runtime pilot

1. Verify credential-free Blueprint validation is present on both main and develop.
   Check consumers of the old repository-level `RENDER_API_KEY`, then remove that
   secret and revoke its old provider token. Do not reuse it as the new key.
2. Apply the reviewed develop Blueprint's Manual Preview generation and updated
   build command to the Development service. Audit inherited variables/groups:
   no provider/owner credentials or shared per-PR database binding may be inherited.
3. Confirm Actions permits the reviewed controller and its protected Environments.
   Dispatch from `main` only; do not run the cloud CLI locally with provider keys.
4. Open a separately reviewed runtime pilot PR targeting develop. Verify baseline
   CI, migration review when requested, isolated database provisioning, exact-SHA
   deployment, HTML/browser checks and Lighthouse acceptance under the temporary
   Performance exception below.
5. Complete the remaining two-PR, reuse, exclusions, capacity, failure recovery and
   cleanup evidence listed in `docs/operations/isolated-preview-automation.md` on
   develop before closing #96. A Live Render deployment alone is not acceptance.

Environment/secret setup, token revocation, merge and live provider acceptance are
operator actions. Preparing this branch does not perform or prove those actions.

## Normal expiry and recovery

Initial reservations and explicit recreation use the same fixed seven-day TTL,
rounded to seconds. Pushes/retries do not extend an existing reservation. A
Preview that expires during preparation cannot be marked ready.

Closing/merging cleans the PR resources. Daily reconciliation (03:23 UTC, subject
to GitHub scheduler delays) also cleans expired open PRs; Neon expiry is an
independent safeguard. An expired/cleaned Preview is not implicitly recreated.
After confirmed cleanup, dispatch `Isolated Preview` from trusted `main` with
`operation: recreate`. This requires an open PR, successful CI, applicable exact
SQL approval, available capacity and no unresolved cleanup/inventory alerts.

Cleanup failure creates one deduplicated bot alert. Inspect the signed record,
current closed/expired state and exact provider identities; retry normal
reconciliation. Keep the alert open until provider absence is confirmed, then
resolve it manually. Never edit signed state, reset a database or delete the
empty parent/base service to recover a Preview. New allocations remain blocked
while cleanup/inventory alerts are open.

Temporary short-TTL, cleanup-failure and read-only allocation-probe operations
have been removed. The supported manual lifecycle choices are only `run` and
`recreate`; there is no pilot allowlist, deadline or production fault injection.

## Controller HTTP failure diagnostics

The CLI emits a fixed diagnostic such as
`stage=inspect-files; http=500`. Stage labels are allowlisted; the HTTP code comes
only from a typed provider error and is validated as a number. `http=0` means no
HTTP response was obtained (transport/timeout); `http=unknown` means no safe HTTP
code is available, for example a validation or JSON parsing error. Neither value
is a successful response. Raw error messages/stacks, URL/query strings, headers,
upstream response bodies and credentials are not included. A secondary failure
while publishing the failure status does not replace the original diagnostic.

HTTP 500 on GET now uses the existing bounded read budget: at most three attempts,
with pauses of one and two seconds and the existing 30-second request timeout.
The change does not add HTTP 500 retries for POST/PATCH/PUT/DELETE, extend retry
budgets, ignore failures, bypass complete PR-file verification or provision a
Preview when metadata cannot be verified. Existing treatment of other status
codes and mutations is unchanged. Persistent HTTP 500 still fails closed.

For PR #120, the exact GitHub `/pulls/120/files` REST route returned HTTP 500 in
direct read-only checks while the PR metadata and commit comparison succeeded.
This is a provider metadata failure, not a failed application test. Do not replace
the verified file inventory with an unchecked fallback merely to get a green run.

After this fix is reviewed and merged into `main`, start a **new** trusted workflow
run from current `main` (for a docs-only PR, `operation: run` should report the
non-runtime exclusion after verified metadata). Re-running an old failed Actions
attempt retains its recorded workflow/source revision, so it does not install the
fix. Check the new run's actual checkout SHA and diagnostic. If GitHub continues
returning HTTP 500, investigate the upstream route; extra commits or repeated
workflow runs are not proof of recovery.

## Lighthouse trace diagnostics

Render PR Preview Lighthouse collection retains Chrome `*.trace.json` and
`*.devtoolslog.json` assets from the same three measured navigations per URL.
They are written in the controller working directory (`scripts/preview`), not
the HTML/JSON report output directory. The lifecycle workflow uploads both
locations in the existing seven-day Lighthouse artifact, including on assertion
failure. Match assets to reports by URL and timestamp; load a trace into Chrome
DevTools Performance to inspect the actual event timeline. Simulated Lighthouse
metrics and observed trace timestamps are different evidence and must not be
combined as one timeline. Traces can include public HTML, URLs and network
metadata: keep this diagnostic limited to synthetic, unauthenticated Previews.
The Lighthouse subprocess still receives no provider credentials. No extra
navigation or throttling change is introduced. Numeric budgets remain unchanged;
the temporary exception below changes only three assertions' severity.

## Temporary cloud Performance exception — issue #96

Approved on 2026-10-22 while the public UI is provisional and will be replaced.
The trusted controller explicitly passes `LHCI_PREVIEW_PERFORMANCE=diagnostic`
to its credential-free Lighthouse subprocess. Only an exact
`pro-league-development-pr-<number>.onrender.com` host honors it. Performance
scores (home and Admin), home LCP and home TBT become warnings, not readiness
blockers. All three runs, original numeric thresholds, reports and traces remain.
Warnings are diagnostic evidence, not proof that Performance acceptance passed.

Accessibility, best practices, CLS, successful Lighthouse collection, smoke,
noindex, exact deployment SHA, reviewed migrations, Golden verification,
database/reader isolation and every trust/cleanup gate remain blocking. There
is no blanket `continue-on-error`, swallowed process error or skipped audit.
Baseline CI, local runs, non-Preview hosts and manual runs without explicit
opt-in retain their strict budgets. The controller logs the active exception.

For #96, successful lifecycle evidence may therefore include recorded cloud
Performance warnings; it must still satisfy all other acceptance requirements.
Do not close #96 until concurrency, reuse, exclusions, capacity and cleanup
evidence are complete. This exception supersedes the strict-cloud-Performance
requirement in the develop runbook; it does not waive the remaining gates.

Restore strict cloud Performance before accepting the replacement UI: remove the
controller opt-in, verify config regression tests, and record successful strict
three-run cloud measurements. Restoration is part of final-UI acceptance, not
an indefinite waiver. Controller changes require a reviewed PR into `main` and
an operator merge; do not activate them from an untrusted feature branch.

Controller configuration and workflow changes take effect only after review and
promotion to trusted `main`; a feature-branch edit does not change a running
controller. Do not execute untrusted PR controller code to obtain diagnostics.
