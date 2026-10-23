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

## Evidence and closure

For each result retain the immutable SHA, UTC timestamp, environment, browser/tool
versions, workflow URL, report/artifact link and expected/actual outcome. Preserve
initial failures and classify any infrastructure retry. Milestone artifacts need
90-day retention; sanitized summaries remain versioned with issue links. Never
publish credentials, private files or real personal data.

After implementation PR review/merge, verify the final candidate and automatic
cleanup, replace pending rows with evidence, then decide whether to close #97 and
M3 / #37. This policy document alone does not satisfy or close either issue.
