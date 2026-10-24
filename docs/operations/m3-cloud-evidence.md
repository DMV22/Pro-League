# M3 cloud evidence retention

Status: implementation awaiting review and first GitHub collection. This document
does not grant M3 acceptance or close #97. The marker-only pilot #117 must remain
open until collection succeeds; it must never be merged.

## Boundary

`M3 cloud evidence` is a manual, read-only collector on reviewed `main`. Its only
GitHub permissions are contents/actions/pull-requests read. It has no Environment,
provider secret, database connection or resource-mutation step. GitHub's token is
passed only to metadata validation and controller-artifact download, not browser
or Lighthouse processes. Checkout credentials are not persisted.

The collector validates an open same-repository PR into `develop`, its exact head
SHA, a successful `Isolated Preview` run and `reconcile` job, and the latest status
of the matching Render GitHub deployment at the generated exact PR origin. The
only allowed difference from the reviewed application baseline is the added
`public/m3-acceptance-pilot.txt` marker. It checks out **the baseline**, never the
PR head, to obtain navigation/axe tests. Downloaded controller evidence is data,
not executed code. Metadata is corroborating GitHub evidence, not a new independent
provider attestation or HMAC verification; existing controller ownership/safety
checks remain responsible for that boundary.

Before and after collection, PR SHA, baseline, controller artifact and deployment
are revalidated. The report gate requires exactly 12 successful desktop/mobile
navigation/axe cases with no retries, skips, expected failures or quarantine. It
requires three mobile Lighthouse reports each for home/Admin (copied controller
evidence) and Competition/Season (fresh collection). Accessibility, Best Practices
and CLS median budgets remain blocking. Performance/LCP/TBT are explicitly labelled
diagnostic exceptions within the already approved #97 scope, not strict passes.
This does not alter strict baseline budgets or the trusted controller's policy.

## Run after review and merge into main

1. Keep the selected pilot open and its controller artifact unexpired. Do not push
   another pilot revision while collecting. If the SHA changes, collect against
   the new successful controller run instead; do not reuse old evidence.
2. Dispatch the workflow from `main`, with the exact PR head SHA and successful
   controller run ID. For the current pilot:

   ```powershell
   gh workflow run m3-cloud-evidence.yml --repo DMV22/Pro-League --ref main -f pr=117 -f sha=909d24c9533a1bab9024b12192af15221bf78bae -f controller_run=40111944551
   ```

3. Inspect the whole run, not just artifact upload. Required smoke, browser,
   Lighthouse collection, identity recheck and summary steps must all succeed.
   An artifact from a failed run is retained diagnostic evidence, not acceptance.
4. Verify `m3-cloud-PR-SHA-RUN` exists and its API `expires_at` provides the required
   90-day retention. Repository retention settings must permit that duration.
   Download and inspect `acceptance.json`, the before/after target metadata,
   browser JSON/traces, copied controller reports/traces and fresh route reports.
   Raw Lighthouse assets and logs are included; metrics retain versions, collection
   timestamps, emulation/throttling conditions, medians and ranges. Field data is
   unavailable, not passed. The collector does not replace manual keyboard evidence.
5. Record the run/artifact links and exact SHAs in the application-side M3 exit-gate
   document. Earlier local measurements are not relabelled as this CI run.
6. Only after evidence is durable, close the pilot **without merge**, verify the
   existing controller's cleanup and provider absence, and record that separate
   evidence before the final internal #97/M3 decision.

The new archive copies the original seven-day controller artifact into a separate
90-day milestone artifact; it does not extend or mutate the original artifact.
It does not merge application code from `develop` into `main`, provision another
Preview, approve SQL, close a PR or declare the milestone complete.

## Local implementation verification

The metadata validator was exercised read-only against pilot #117 and successful
controller run `40111944551`. A source export of reviewed baseline
`e90033445923ea3787acdc75b68deb3ab1524789` ran the selected 12 cloud navigation/axe
cases successfully, zero retries/skips, against pilot `909d24c`.
The report gate accepted those actual browser results and the six existing route
Lighthouse reports. A fresh three-run-per-route collection with `saveAssets`
then passed the complete local summary, including actual browser trace files,
copied controller reports/traces, route trace/network assets and launched tool
versions. This local rehearsal is labelled `local-uncommitted`, not a CI run.
All 26 Node checks passed; changed-file ESLint, formatting, YAML parsing and
`git diff --check` passed. Negative checks cover changed SHA, forks, closed pilots,
runtime changes, failed/wrong controller, missing/expired/oversized artifacts,
incorrect deployment URL, incomplete matrix, retry/quarantine, missing/redirected
measurements and non-exempt CLS failures. The first PowerShell invocation failed
before tests because an unquoted comma split `--reporter=line,json`; quoting the
argument fixed local invocation. The workflow uses Bash and is unaffected.
None of these local checks proves that the new 90-day GitHub archive exists yet.
