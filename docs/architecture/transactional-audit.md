# Transactional Audit History

Issue: #126. Boundaries: ADR-0021, ADR-0019 as amended by ADR-0025.

## Ownership and interface

Governance owns `AuditPort.append()` and the inserts into `audit_events`,
`audit_event_targets`, and `audit_event_changes`. There is no update/delete API.
The repository receives the current Drizzle transaction; it never opens a second
connection or calls an external provider. Existing schemas and migrations are reused.

`TransactionPort.run()` composes the Audit port with the domain repositories.
The returned receipt contains the caller-supplied Event ID, database-generated
sequence number and server `timestamptz` timestamp. The receipt is provisional until
`run()` resolves: an enclosing rollback also removes the Event, targets and evidence.
Sequence values may have gaps and do not prove commit order. Child records use UUIDv7;
IDs are not credentials or authorization evidence.

## Safe event projections

Register action policies through `createTransactionAdapter(database, { auditPolicies })`.
An unregistered action is rejected. The runtime default is deliberately an empty
registry; real command policies are wired by subsequent protected-command work.

Each policy lists permitted diff fields and whether reason and Supporting Reference
are mandatory. The port validates bounded, plain data and snapshots it before the
first asynchronous write. It accepts:

- Admin Identity ID with approved display/email snapshots, or a System/operator snapshot;
- action, outcome, source, correlation key and optional command key;
- bounded target IDs, optional versions and display snapshots;
- scalar-only, versioned field changes **or** a typed immutable revision ID;
- existing Supporting Reference IDs, recorded as related `supporting_reference` targets.

The adapter checks reference existence without copying reference contents into the
Event. Revision references are polymorphic: the calling module must verify that the
referenced revision exists, is immutable and is appropriate for this action.

Unknown fields, arbitrary nested payloads and credential-shaped diff field names
are rejected. This is an allowlist boundary, **not** automatic secret discovery or
redaction of arbitrary strings. Callers must construct approved server projections;
never pass request bodies, provider payloads, cookies, tokens, signed URLs, private
document contents, raw exceptions or network/session metadata as evidence or reason.
Temporary private security context is not part of this immutable append API.

Actor snapshots are historical evidence, not authentication or an Active Grant.
Authorization and command-policy checks remain separate responsibilities. This port
does not enable Security Review-gated operations or change the Clerk Hobby constraints.

## Commit and failure protocol

For an accepted mutation, await both the domain change and `audit.append()` within
the same `run()` callback. Await `run()` before reporting success. Any append failure
poisons this transaction: even catching it inside the callback cannot allow commit.
All repository promises must be awaited; do not retain transaction repositories or
launch background work from the callback.

The infrastructure does not automatically audit every low-level repository write.
The protected command executor (#127) will select the action policy and enforce the
complete authentication/authorization/mutation protocol. No new write endpoint is
introduced by #126.

For a denied/failed attempt, first await rejection/rollback of the domain transaction,
then append a separate Event through a **new** `run()` call. Use a new Event ID, the
same correlation key and a safe outcome/reason code selected by the server. Do not
write the failure Event in the transaction that is about to roll back.

If this separate append also fails, propagate an explicit failure; never report a
successful mutation or fabricate an Audit receipt. There is no unaudited fallback,
automatic retry, or logging of raw database error text.

`AuditFailure.kind` is `invalid`, `conflict`, `retryable`, or `unavailable`. Duplicate
Event IDs reject with `conflict` without modifying the original Event. A correlation
key groups distinct Events; it does not deduplicate commands. Idempotency and retry
policy belong to subsequent command work, not this repository.

## Database enforcement and verification

Existing migrations restrict the `app_runtime` role and install immutable-record
triggers. Runtime INSERT is exercised against all three Audit tables; actual
UPDATE/DELETE/TRUNCATE attempts must fail, not merely appear absent from TypeScript.
Database owners remain privileged; this is not a tamper-proof hash-chain ledger.

`scripts/db/verify-audit.ts` runs as part of `pnpm db:integration` on guarded,
loopback-only disposable PostgreSQL 18 databases. It verifies atomic commit and both
rollback directions, a caught append failure, separate failure recording, restricted
role writes, duplicate/correlation behavior, actor snapshots, safe evidence and
required references. It also verifies public navigation remains usable while runtime
Audit INSERT is denied. The test temporarily revokes specific INSERT grants and
restores them in `finally`; never run it against shared or deployed databases.

Local verification for this change: types, targeted ESLint, unit suite and PostgreSQL
integration suite. CI/merge evidence is still required before closing #126.
