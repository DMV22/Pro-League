# Protected command contracts — M4

Scope: #125, part of #38. These are contracts and a pure envelope parser, not an
authorization implementation or a runnable mutation path. ADR-0021 and ADR-0025 remain authoritative.

## Interfaces and ownership

- `src/shared/application/command-context.ts`: server-resolved Admin/System actor and correlation context.
- `src/application/commands/envelope.ts`: untrusted transport envelope → validated metadata, with an **unknown** payload.
- `src/application/commands/contracts.ts`: typed authorization decisions, command outcomes, internal execution identity and the protected Admin command signature.
- `src/application/commands/contracts.typecheck.ts`: compile-time examples checked by `pnpm types`; not a runtime test suite.

No contract imports Next.js, React, Clerk or an ORM. Existing `ExpectedVersion` is reused.
Concrete Audit, Outbox and command-execution ports stay with their owning modules and will be
introduced by #126–128 when they have implementations; this task does not build a generic bus.

## Untrusted input versus trusted context

An external adapter passes decoded transport data to `parseCommandEnvelope(input: unknown)`.
Only `idempotencyKey`, `payload`, and optional `expectedVersion` are permitted at the top level.
Actor, grant, correlation, command type, execution scope and payload hash are never accepted there.
The command type comes from the server-selected operation, not a client-selected dispatch name.

```json
{
  "idempotencyKey": "request-123",
  "payload": { "title": "Навчальний приклад" },
  "expectedVersion": {
    "id": "019a0123-4567-7890-abcd-0123456789ab",
    "expectedVersion": "3"
  }
}
```

The payload above is illustrative, not an M4 News Article feature. A valid envelope does **not**
validate its payload, authenticate its caller or authorize execution. The owning command must
validate the payload into its own input type before execution; do not cast `unknown` to that type.
Null/primitive payloads are intentionally left to that command's schema. Missing/undefined payload is rejected.
HTTP adapters must additionally bound request body size before decoding; the parser is not an HTTP firewall.

Metadata policy:

- Key: 1–128 ASCII characters, starts alphanumeric, remaining characters alphanumeric or `._:-`.
  No trimming, case-folding or implicit replacement; a retry keeps exactly the same key.
- Expected version: omitted for commands where no existing aggregate version is applicable.
  When present, it contains only a UUID `id` and a canonical positive decimal string `expectedVersion`.
  It is parsed to the existing `bigint` contract, range 1–9223372036854775807. UUID spelling is lowercased.
  Numbers, leading zeros, signs and exponent notation are rejected to avoid ambiguity or lost precision.
- Explicit `expectedVersion: null`/`undefined` is invalid, not equivalent to absence.
- Unknown metadata fields are rejected, not silently discarded. Issues contain fixed field/code pairs;
  neither raw values nor attacker-selected field names are echoed.

The key length/alphabet are application transport limits, not claimed PostgreSQL constraints.
Request correlation is generated/validated by the trusted adapter per attempt and is distinct from
an idempotency key identifying a repeated intent.

`AdminActor` carries local Identity/Grant IDs and completed-session context. `SystemActor` is selected
only by a trusted operator, job or verified-webhook adapter; it is not accepted by `ProtectedAdminCommand`.
These are structural TypeScript types, **not authorization capabilities**. Assertions or unvalidated JSON
can defeat static checks. Only the future server authorization and transactional grant check establish authority.

## Execution order required of the future executor

1. Establish a completed verified session, resolve the stable external identity to local Identity and
   current Active Grant, and create server context. Deny on missing/Invited/Suspended/Revoked/unavailable data.
2. Parse the envelope and validate its domain payload without performing a mutation. An adapter may
   reject malformed transport earlier, but parsing never substitutes for authorization.
3. Derive execution identity on the server. The unique database pair is `actorScope + idempotencyKey`.
   Scope must separate Admin access periods/System operations **and command types**, using an unambiguous
   encoding of the tuple, not separator-based concatenation of arbitrary strings.
4. Derive `payloadHash` from a versioned canonical representation of the validated command intent,
   including command type and expected version. Never hash raw JSON insertion order, request correlation,
   current time or mutable display snapshots. The concrete canonicalizer/hash and durable replay-result
   storage will be implemented and tested in #127; this contract does not claim either exists yet.
5. Within a short transaction revalidate current permission with concurrency protection, atomically
   claim execution, and either return its recorded outcome or execute the owning module's command.
   A replay **also** requires current authorization. Same scope/key with different intent is a conflict.
6. Commit domain change, accepted Audit Event, execution outcome and required Outbox intents together.
   No external HTTP calls inside the domain transaction. Audit or Outbox failure prevents acceptance.
7. On a denied/failed attempt, roll back any domain transaction before appending its separate failure
   Audit Event. If auditing itself is unavailable, deny the operation and signal operational failure;
   do not claim the missing audit was recorded.
8. Perform external effects after commit through Outbox. Failure leaves External Sync Pending and
   does not undo an accepted domain change. Delivery is at least once, so handlers are idempotent.

## Outcomes and retry semantics

| Status | Meaning | Retry policy |
| --- | --- | --- |
| `succeeded` | Accepted result; `value` is the command's safe output | Same intent/key can replay after a fresh authorization check |
| `unauthenticated` | No completed verified session | Sign in; no automatic command retry |
| `forbidden` | Current local access denied | No automatic retry or fallback permission |
| `invalid` | Envelope or owning-command validation failed | Correct input; changed intent needs a new key |
| `conflict` | Stale version, reused key with another intent or domain conflict | Refresh/review; never silently overwrite |
| `unavailable` | Authorization, Audit, persistence or unexpected failure | Fail closed; no blanket automatic retry |

Public failure codes contain no raw `Error`, SQLSTATE, provider response, stack or credentials.
Success outputs must also be explicitly selected safe view models, not ORM/provider records.
The existing `PersistenceFailure` remains an internal persistence concern, not a public command result.
Only its positively identified `retryable` failures (serialization/deadlock) are candidates for bounded
executor retry with unchanged intent and renewed validation. Retry implementation belongs to #127.
No UI/HTTP status mapping is added here; those adapters must handle the outcome union exhaustively.

## Verification and limits

Agreed test seams: the public envelope parser and the exported TypeScript contracts.
Runtime tests exercise acceptance/rejection through the parser, not private helpers.
Compile-time examples cover actor separation, expected-version reuse, safe outcome codes and exhaustive handling.
These checks do not prove real authorization, atomicity, duplicate suppression, Audit durability or delivery.
Those require the later module adapters and PostgreSQL/Clerk integration evidence under ACC-AUTH-001.

No Clerk SDK, routes, schema migration, Production setup or sensitive capability is enabled.
The initial Clerk Hobby posture and Security Review gates from ADR-0025 are unchanged.

### Local verification — 2026-10-26

- `pnpm types` — passed, including the compile-time negative examples and exhaustive outcome handling.
- Targeted ESLint and Prettier checks for the new TypeScript files — passed.
- Envelope parser — 45 runtime cases passed.
- `pnpm exec vitest run --maxWorkers=2` — all 37 test files / 249 tests passed.
- The initial unrestricted `pnpm unit` run had an LHCI child-process timeout and three worker-start
  timeouts. The complete bounded-worker rerun passed without changing tests, timeouts or configuration.
  This is local verification, not a claim that GitHub CI or external Admin acceptance has run.
