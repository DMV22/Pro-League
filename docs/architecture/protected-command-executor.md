# Idempotent protected command executor

Issue #127 builds on the contracts in #125, transactional Audit in #126 and Outbox in
#128. ADR-0021 ownership/consistency and ADR-0025 capability gates remain authoritative.

## Entry and ownership

`src/application/commands/execute-admin-command.ts` composes module-owned ports. It is
an internal application entry, not a Server Action, HTTP route or client-selected bus.
The server selects a reviewed `AdminCommandDefinition`, a trusted session adapter and
the transaction adapter. There is no production fixture command or runtime activation.

`AdminSessionPort.verify()` must return only a completed, provider-verified session's
subject/session ID, or null. It must never parse client actor IDs into trusted context.
The concrete Clerk adapter and authentication acceptance remain #129; this issue does
not install Clerk, configure secrets or assert that authentication is already live.
That adapter must also enforce the documented session invalidation/restoration policy;
an Active local Grant alone never proves a previously suspended session is usable again.

Identity/Access resolves the external mapping, active local Identity and current Active
Grant inside the committing transaction. Mapping, Identity, then Grant acquire shared
row locks held through commit. Grant effective time uses PostgreSQL's clock; ended,
Invited, Suspended, Revoked or retired identities cannot execute or replay. Access
writers must respect this order. A revocation that commits first prevents the command;
a command holding authorization locks commits before a waiting revocation can complete.
This is serialization, not cancellation of an already committed decision.

## Operations-owned intent policy

`src/modules/operations/application/command-intent.ts` is the single owner of command
identity and replay rules. `prepareCommandIntent()` prepares the canonical hash before
locks are taken, then supplies identity construction, safe replay and accepted-result /
Outbox projection. `readCommandExecution()` interprets the locked persisted row without
owning SQL or row locks. Metadata validation and UUIDv7 execution/effect identity rules
are housed in the same module; canonical encoding and safe-result helpers are private.

This replaces the smaller `command-values.ts` module and removes those decisions from
the executor and PostgreSQL adapter. The existing `executeAdminCommand`, `CommandExecutionPort`
and transaction interfaces are unchanged. Scope/hash bytes, result schema, ID derivation,
limits, failure classification and migration history remain unchanged. Authorization
stays with Identity/Access; generic failure composition and fixture organization are
not part of this refactoring.

## One accepted command

1. Snapshot input before authentication yields; verify the session and validate the
   envelope and owning command's payload. Transport adapters still bound body size and
   provide their own origin/CSRF, rate-limit and session-verification controls.
2. Build a versioned canonical intent hash. Tagged scalar/array/object representations
   distinguish types; object keys are sorted, array order matters. Intent includes
   command type/version and expected version, but excludes correlation, session ID,
   time and display snapshots. Undefined, non-plain objects, excessive depth/nodes and
   encodings over 32 KiB fail closed. Owning validators normalize business equivalents.
3. Revalidate local permission under locks, including every replay and transient retry.
   The unambiguous JSON scope tuple contains format version, Identity ID, Grant ID and
   server-selected command type. Another actor/access period/command has a separate
   scope. Same scope/key with a changed intent returns `idempotency_conflict`.
4. Operations inserts a pending execution using the existing unique scope/key index.
   A competing insert waits for commit/rollback. A committed success replays its stored
   result; an aborted transaction leaves no claim and can be attempted again.
5. The owning command receives only domain repositories, validated input, trusted actor
   and correlation context. It checks aggregate expected versions and business rules.
   `CommandConflict('stale_version')` and `CommandConflict('domain_conflict')` are explicit
   non-retryable outcomes. Generic repository conflicts are `domain_conflict`.
6. The executor appends accepted Audit evidence, enqueues effects and completes the
   recorded outcome in that same transaction. Audit identity/action/outcome/correlation
   come from the executor, not the browser. Audit/Outbox/persistence failure rolls back
   the entire decision. Commands must await all repository work; no HTTP/provider/cache
   calls or untracked work are allowed inside the transaction.

Commands supply an explicit safe result projection and allowed field list. Results are
flat records with at most 16 allowed fields, safe integers/booleans/null and bounded
identifier-like strings; credential/private fields and arbitrary free text are rejected.
This is an allowlist, not general DLP: the owning module still reviews the projection.
Result payloads are bounded to 8 KiB. Replays validate the stored result/version before
returning it and never reconstruct a response from newer mutable domain state.

Commands describe at most 16 Outbox effects with unique bounded effect keys. The executor
derives UUIDv7 message IDs from one execution ID plus each key, and supplies correlation
and causation. IDs remain unchanged across a transaction retry. Real adapters still
deduplicate delivery as documented in [transactional-outbox.md](transactional-outbox.md).

## Failures and retry

Unauthenticated requests stop before a local protected attempt and never read recorded
results. Authenticated denied/invalid/failed attempts append `admin.command_attempt`
evidence in a separate bounded transaction after rollback (or without starting a domain
transaction). Before local identity is established the actor is explicitly System
`Protected command entry`, not an unverified claimed Admin. Failure evidence contains
the reviewed server command type and fixed outcome classifications, no raw request,
exception, SQLSTATE or provider text.
If this audit cannot commit, the result is `audit_unavailable`, not a claim that logging
succeeded. No negative outcome commits partial domain work or a success execution row.

`src/application/commands/command-failure.ts` owns the failure-Audit action and policy,
safe outcome classification, transient retry decisions and separate failure recording.
The executor delegates these decisions rather than maintaining another action name,
error-family list or retry budget. `CommandConflict` remains re-exported from the
executor's existing import path. Module-specific persistence interpretation stays in
the adapters: an Operations storage constraint is still an unavailable operation, not
a domain conflict.

Trusted server composition can explicitly opt into
`createProtectedCommandTransaction()` from `src/server/commands/protected-command.ts`.
This server-only factory installs the reserved `admin.command_attempt` Audit policy
with `requireReason: true`, empty `changeFields`, and no reference requirement.
A conflicting caller policy is rejected synchronously before any command transaction;
an equivalent supplied policy is accepted but replaced by the canonical immutable
policy. Later mutation of the supplied registry/policy cannot weaken this reserved entry.
The reserved action is for failure evidence, not an accepted business-command type.

Accepted business-command Audit policies and required Outbox policies remain explicit.
The generic `createTransactionAdapter()` is unchanged: its registries remain empty and
deny-by-default, and existing callers can still supply their own explicit composition.
Commands with required reasons/references must supply accepted evidence; rejected-attempt
evidence uses the separate fixed policy. This opt-in factory adds no route, Clerk adapter,
new database permission or runtime activation.

Only positively classified PostgreSQL serialization/deadlock failures (`40001`, `40P01`,
including those mapped through Audit/Outbox) permit automatic retry: three total attempts,
25/50 ms delays, identical validated intent and execution/effect IDs. Each attempt verifies
the session again and re-locks current local access. Changing subject or access scope
cannot switch the actor mid-retry. Validation, version/domain/unique conflicts, unknown
exceptions, timeouts and other persistence failures are not automatically retried.
Each executor/failure-audit transaction sets a 2-second lock timeout and 5-second statement
timeout; trusted command code must still keep its own computation and all DB work bounded.

## Migration and retention

`0003_command_execution_results` adds nullable `result_schema_version` and `result_payload`
to the existing Operations-owned table. The database checks paired nullability, positive
schema version, JSON object shape and an 8-KiB serialized size limit. Legacy reference
columns and rows are preserved. A legacy/pending/failed/unsupported record without a
usable payload fails closed and never reruns its domain mutation.

New rows retain the existing 30-day operational expiry policy. Expiry is not permission
to replay the effect again: this executor never automatically deletes, resets or reuses
an expired claim. No cleanup scheduler is enabled. A later reviewed retention process
must document when permanent evidence makes deleting ordinary execution records safe.

## Verification and remaining gates

Approved test seams: `executeAdminCommand` and guarded isolated PostgreSQL inspection,
using synthetic internal commands only. `scripts/db/verify-command-executor.ts` runs
inside `db:integration`: concurrent replay, changed intent/version, actor/command scope,
canonical object order, optimistic conflict, immutable recorded response, revoked-access
lock races, real `app_runtime` execution, Audit/Outbox rollback, safe output rejection,
legacy results and injected serialization/deadlock/non-transient SQLSTATE behavior.
Synthetic triggers/sequences are invocation-owned and removed afterward; immutable
Audit History and its referenced synthetic identities are never deleted.

Compatibility characterization also pins a known persisted canonical hash and exact
scope encoding, checks changed stored intent type before unusable replay state, and
exercises the existing effect-key/result-field budgets through the executor. No tests
call private policy helpers.

Protected composition scenarios additionally verify automatic failure evidence,
conflicting reserved-policy rejection, immunity to caller configuration mutation,
generic default-empty behavior, explicit accepted-action registration and redaction of
unknown failure messages. Existing retry/rollback/race scenarios run through the same
executor/PostgreSQL seams; no private failure-policy helpers are tested directly.

The test-only `scripts/db/command-executor-fixtures.ts` owns synthetic actors,
tracked mutable Competition/Outbox rows, dedicated sessions, temporary fault objects,
and access-state restoration. Named scenarios keep assertions in the verifier and
stop at the first failure; explicit returned fixture values preserve intentional replay
dependencies without pretending every scenario is independent.
Cleanup attempts every registered action in reverse acquisition order, even if another
cleanup fails. Scenario errors retain their name and original cause; secondary cleanup
errors are reported together, not substituted for the original assertion.
Revocation cleanup releases its lock before draining pending work and restoring access.
Dedicated sessions are destroyed rather than returned with possible role/transaction
state; notice listeners are removed. Fault objects are registered for cleanup as each
setup step succeeds. The suite closes its pool even when setup or row cleanup fails.
A deliberately aborted PostgreSQL scenario verifies rollback, backend termination,
fault-object removal and preservation of the original error. A one-connection pool also
verifies cleanup after partial session acquisition times out. Immutable Audit History
and its referenced Admin Identity remain retained. Integration target guards are unchanged.

No production route, business command, automatic worker or sensitive capability is
enabled. Full CI, owner merge and post-merge verification remain required before closing
#127. Authentication/session integration and broader Admin access acceptance remain
subsequent M4 work, not implied by the synthetic session adapter.
