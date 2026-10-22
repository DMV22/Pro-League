# Temporary issue #96 acceptance drill

This is a temporary addition to [Preview bootstrap](preview-bootstrap.md), not
evidence that the cloud drill has passed. Remove the acceptance-only mechanisms
after recording live evidence. PR #112 must never be merged.

## Scope and gates

The manual operations `recreate-short-ttl`, `test-cleanup-failure` and
`test-allocation-block` are pinned to PR **112**, SHA
`f07f84df761a650de66667be00f18721eea78183`, branch
`codex/m3-preview-safety-pilot`, repository `DMV22/Pro-League` and base `develop`.
They require `workflow_dispatch` from the trusted `main` lifecycle workflow and
refuse execution on or after **2026-10-30 00:00 UTC**. Ordinary reservations and
recreations remain seven days. Automatic events and daily sweeps never inject
faults or shorten reservations. Existing ownership, SQL approval, CI, capacity,
smoke and Lighthouse gates remain in effect for provisioning.

## Live sequence, after the controller PR is reviewed and merged

1. Record SQL evidence: stale A approval refused (run `39861126515`), current B
   approved and ready (run `39865204945`). Close #112 **without merging**, verify
   real cleanup and provider absence, then reopen it without changing its SHA.
   Never edit signed comments or branch expiry/annotations by hand.
2. Dispatch **Isolated Preview** from `main`, PR `112`, operation
   `recreate-short-ttl`. This requires a confirmed `cleaned` record and no open
   cleanup/inventory alerts. The new **30-minute** expiry flows through the normal
   signed reservation, Neon branch and signed annotation. If readiness outlasts
   TTL, clean and explicitly recreate; do not extend it manually.
3. Keep the PR open and wait until its signed expiry. Coordinate with the daily
   sweep (03:23 UTC): do not run the drill across that sweep, which must remain
   able to genuinely clean resources. Neon may independently expire its branch;
   inspect the remaining resources rather than claiming the branch survived.
4. Dispatch `test-cleanup-failure` twice. Open, unexpired reservations are refused
   before the injection. After expiry the real cleanup catch/alert path runs, but
   removal throws **before any provider deletion**. Both runs should fail.
   Confirm unchanged signed state, remaining resources, and exactly one open bot
   issue with marker `<!-- preview-cleanup-failure:112 -->` and recovery guidance.
5. Dispatch `test-allocation-block`. This is a **read-only admission-guard probe**,
   not a full provisioning attempt. Its step receives no Neon/Render keys and
   succeeds only when the same guard used by normal preparation throws the typed
   cleanup/inventory-alert refusal. Other API errors must fail. Confirm separately
   that the open alert is the expected #112 alert. No allocation/state write occurs.
6. Dispatch normal **Preview cleanup reconciliation** from `main`, without fault
   injection. Verify `cleaned`, absence of the exact Neon/Render identities, and
   safe repeated cleanup. Cleanup does not close the alert: resolve it only after
   inspecting provider absence and ownership. Normal `run` must refuse to recreate
   an expired/cleaned Preview.
7. Dispatch ordinary `recreate`, complete any requested SQL approval, and verify
   a fresh isolated identity, seven-day reservation and readiness. Finally close
   #112 without merging and verify deletion again.
8. Remove `acceptance.ts`, acceptance-only tests, three workflow choices,
   `PREVIEW_OPERATION` routing and CLI acceptance branches via a separate reviewed
   PR to `main`. Keep normal expiry cleanup/alert tests and the shared allocation
   guard. Record Actions links, resource identities, deduplication, recovery and
   final absence before considering issue #96 complete.

The real alert intentionally blocks **all new Preview allocations** until the
operator resolves it. Never revoke shared keys, disable schedules, weaken SQL
approval, reset databases or touch the empty parent/base service for this drill.
