# Transactional Outbox and bounded dispatcher

Issue #128; depends on #126 and supplies the Outbox adapter required by #127.
ADR-0021 consistency rules and ADR-0025 capability gates remain authoritative.

## Ownership and commit protocol

Operations owns `OutboxPort.enqueue()`, the `outbox_messages` writes, and the worker
delivery interface. `TransactionPort.run()` composes this port with domain repositories
and Audit. Await every repository call, then await `run()` before reporting acceptance.
Domain change, accepted Audit Event and Outbox intent share one PostgreSQL transaction.
An enqueue failure forces rollback even if the command catches it. No provider, HTTP,
cache or storage effect runs inside that transaction.

This is a foundation, not an automatically audited command executor or a new public
mutation endpoint. #127 supplies accepted-command outcome/idempotency orchestration.
Existing tables, grants and `version` are reused; no schema migration is introduced.

## Intent identity and safe payloads

The caller allocates an intent ID once and reuses it for the same intent on retry.
The persisted message ID is also the stable downstream idempotency key: every claim,
expired-lease recovery and delivery retry uses exactly that key, never a new attempt ID.
The future executor must retain/reproduce its accepted intent IDs. Correlation identifies
an attempt; it is not an enqueue deduplication key.

Enqueue with an existing ID is a no-op only if type, schema version, canonical scalar
payload, aggregate identity/version and causation agree. Another intent with that ID
is a conflict. Original correlation and state are preserved; replay never resets a
delivered/failed/exhausted message. Different IDs are distinct intents: there is no
implicit business-event deduplication across newly generated IDs.

Register enqueue policies by type using `outboxPolicies` in the transaction adapter.
The default registry is empty (deny by default). Payloads have at most 16 explicitly
listed, required fields. Values are safe integer numbers, booleans, null, or bounded
identifier-like strings; nested JSON, free text, unknown fields and credential-shaped
field names are rejected. Use canonical IDs/version references, not personal records,
private file contents, signed URLs, sessions, provider responses or credentials.
Validation is an allowlist, not arbitrary-string DLP. Caller projections still require
review. All input is snapshotted before asynchronous persistence.

## Claim, fencing and recovery

`OutboxDeliveryPort.claim()` atomically locks eligible rows with `FOR UPDATE SKIP LOCKED`,
increments `version` and `attempt_count`, sets state `leased`, and commits a short
transaction. Only committed intents are visible to other delivery connections.
Time eligibility and expiry use the database clock. Each claim transaction has a
five-second per-statement timeout.

`settle()` updates a row only when its ID, exact claimed version, `leased` state and
unexpired lease all match. Every successful settlement also advances the version.
A stale/expired worker receives `false`, cannot acknowledge/retry someone else's claim,
and cannot overwrite an already settled outcome. A lease is an internal concurrency
token, not an authentication capability; do not expose this interface over HTTP.
Settlement acquires the row lock before evaluating expiry, so time spent waiting for
that lock cannot turn a pre-wait eligibility check into a late acknowledgement.

Expired leases become eligible again. If the attempt budget is already consumed,
claim marks the bounded candidate set `exhausted` without executing another handler.
A claim may return no leases after doing this housekeeping; another invocation can
continue remaining work. There is no unbounded sweep or automatic reset of failures.

## Dispatcher and delivery guarantee

`dispatchOutboxBatch()` processes serially, claiming one message just before invocation
so later handlers do not wait while their leases expire. Known message types and schema
versions are validated before invoking the selected handler. Unknown types and invalid
persisted data become visible `failed` records, not silently discarded work.

Defaults and hard limits:

| Setting | Default | Maximum / invariant |
| --- | --- | --- |
| Messages per run | 20 | 100 |
| Run budget | 30 seconds | 5 minutes |
| Lease | 30 seconds | 10 minutes; at least handler timeout + 5 seconds |
| Handler timeout | 5 seconds | 20 seconds |
| Attempts, including recovered claims | 5 | 20 |
| Retry backoff | 1 second, exponential | capped at 60 seconds |
| Concurrent handlers per invocation | 1 | 1 |

The run budget stops new work and bounds handler waiting; in-flight DB calls/settlement
can add their bounded timeout grace. Injected handlers must honor `AbortSignal` and
use bounded provider I/O. JavaScript cannot forcibly cancel an uncooperative handler
or preempt synchronous CPU work. Timeout requests abort, records a safe retry/exhausted
outcome, and does not assert that the remote effect was cancelled.

Handlers return `succeeded`, `retry` for positively classified transient failure, or
`failed` for a terminal failure. Unexpected exceptions fail safely without blind retry.
No raw exception/provider text is persisted. A final retry/timeout exhausts immediately;
a worker crash on the final attempt exhausts when the expired lease is inspected again.
Database/acknowledgement failure propagates: the dispatcher never fabricates success.

Delivery is **at least once**, not exactly once. A process can perform an external effect
and die before acknowledging it. Lease expiry can also overlap an old, uncooperative
handler with a new worker. Every real downstream adapter must durably deduplicate or
apply an inherently idempotent operation with the stable message key, including concurrent
duplicates. Local process memory and a receipt written only after HTTP success do not
solve this crash window. No provider-wide exactly-once claim is made by this foundation.
There is no strict per-aggregate delivery ordering across workers. Adapters must also
respect the intent's aggregate version where applying an older effect could overwrite
newer state; idempotency alone does not solve out-of-order delivery.

## Operator invocation and deployment mode

The initial mode is a manually invoked, bounded trusted-operator CLI. It is not started
by Next.js requests, module imports, `next start`, an untracked background promise,
Render deployment hooks or a new paid worker/cron service. No cloud settings or secrets
are provisioned by #128. Automatic scheduling/deployment activation needs separate
approval and an explicitly supervised runner before any feature relies on timely effects.

Supply a private `OUTBOX_DATABASE_URL` in the operator process environment; the CLI never
falls back to application or migration URLs. Confirm the exact target database name:

```powershell
pnpm outbox:inspect --confirm-db=YOUR_DATABASE --limit=20
pnpm outbox:dispatch --confirm-db=YOUR_DATABASE --limit=20 --duration-ms=30000
```

Use a restricted runtime-equivalent login with schema usage and appropriate SELECT,
INSERT/UPDATE grants, never the database owner or migration identity. The CLI rejects
superusers, role-creating users and users with Outbox TRUNCATE privilege. It does not
create roles or elevate credentials. Remote URLs require `sslmode=verify-full`.
Keep credentials out of arguments, source control, screenshots and output.

`src/server/outbox-handlers.ts` is the reviewed production composition point. It is
currently empty: no synthetic handler is shipped in production. Therefore dispatch
refuses **before claim** until a real feature registers an idempotent adapter. Inspect
is available independently. This delivery engine is tested through the same interfaces
with a synthetic downstream; registering a real provider remains that feature's work.

Inspect returns a bounded list of IDs, versions, states, attempt counts and fixed safe
codes for failed, exhausted and expired-lease records, without payloads. Unknown stored
outcome text is replaced with `unclassified`. Correlation/causation remain in the durable
message for approved diagnostics; they are never used as credentials.

Reconciliation: inspect the ID/code, determine whether the downstream effect already
happened using its stable key, repair the owning adapter/configuration, and agree the
authorized recovery action. No generic requeue/delete button or direct-SQL reset is
provided; do not generate a new ID to blindly bypass deduplication. Failed effects do
not reverse the accepted domain decision and remain operationally visible.

## Verification

`scripts/db/verify-outbox.ts` is included in `pnpm db:integration`. Guarded disposable
loopback PostgreSQL 18 tests exercise the approved enqueue/transaction, delivery and
dispatcher interfaces. They cover commit/rollback, concurrent duplicate intents, caught
enqueue failure, actual runtime-role inserts and forced insertion failure, concurrent
claim, expiry and stale completion, backoff, exhaustion, timeout, fixed error outcomes,
unknown types, batch limits, and crash-window delivery against a separately connected
synthetic downstream with unique effect keys. A separate connection can lock the queue
row while the handler runs, demonstrating the claim transaction has ended.

Only this invocation's synthetic mutable queue rows are removed afterward. Audit History
is never deleted. Permission fault injection restores the existing grant in `finally`.
Never run this verifier against deployed/shared data. Full CI and owner merge remain
required before closing #128 or starting #127 against this adapter.
