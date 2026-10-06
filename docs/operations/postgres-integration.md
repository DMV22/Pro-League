# PostgreSQL integration verification

Issue [#76](https://github.com/DMV22/Pro-League/issues/76) tests the reviewed migrations and persistence boundary against real PostgreSQL 18. The command is deliberately separate from the ordinary local application database and from the Golden Season seed.

## Local setup (PowerShell)

Start the existing container and create the empty disposable test database once:

```powershell
pnpm db:up
docker compose --env-file .env.local -f compose.postgres.yaml exec -T postgres psql -U proleague -d postgres -c "CREATE DATABASE proleague_integration"
```

Use your private local connection string with the database name changed to `proleague_integration`. Never commit the URL or paste its credentials into a PR. Set the variables only in the current shell:

```powershell
$env:MIGRATION_DATABASE_URL = 'postgresql://<user>:<password>@127.0.0.1:<port>/proleague_integration'
$env:INTEGRATION_DATABASE_URL = $env:MIGRATION_DATABASE_URL
pnpm db:migrate:local
pnpm db:integration --target=local --confirm-db=proleague_integration
```

The integration command requires that exact database name, a loopback host, and explicit confirmation. It never falls back to `DATABASE_URL` or `MIGRATION_DATABASE_URL`, refuses an unmigrated or nonempty database, and requires PostgreSQL major version 18. All domain fixtures in the migration, repository, and public-query checks roll back. The two operational queue fixtures and the lock-order fixture are removed after successful verification, so the command can be rerun. If the process is killed after committing a fixture but before cleanup, recreate **only** this disposable database; do not point the command at another database.

CI can use a separate empty `proleague_integration_ci` database and `--target=ci --confirm-db=proleague_integration_ci`. Wiring it as a blocking PR job belongs to [#77](https://github.com/DMV22/Pro-League/issues/77).

## What the command verifies

`db:integration` runs, in order:

1. Migration inventory and positive/negative SQL constraint cases in `verify-initial-migration.ts`.
2. Module repositories, optimistic conflict mapping, and multi-module transaction rollback in `verify-repositories.ts`.
3. Public Query Layer visibility, current-result selection, empty states, and serializable output in `verify-public-queries.ts`.
4. Restricted public-role reads, a rejected decision rolling back Competition, Audit Event, and outbox together, two-session `SKIP LOCKED` claims for both queues, and the repository's Competition-before-Season lock order.

The constraint matrix in `docs/architecture/relational-schema.md` maps to acceptance evidence as follows. “Later command” is an explicit boundary: these rules require an application use case that does not yet exist, not an assertion that PostgreSQL alone enforces them.

| Critical invariant | Current evidence / remaining command boundary |
| --- | --- |
| Current Season ownership | Cross-Competition pointer rejected; repository optimistic version and parent-before-child lock tested. Designation command is later. |
| Active Format selection | Foreign Season Format pointer rejected; selected version is immutable. Atomic activation/amendment is later. |
| Immutable histories and snapshots | All immutable triggers inventoried; Slug and Format version mutation rejected. Snapshot reconstruction from input versions is later. |
| Unique Stage, group, round and slot codes/order | Distinct fixtures accepted; duplicate Stage, group, Fixture Round, Knockout Round, and participant slot codes rejected. |
| One Qualification Rule destination | Valid direct-slot rule accepted; missing destination rejected. Source/destination compatibility is later graph validation. |
| No duplicate current Stage/Round participant | Forward migration backfills and maintains current projections; partial unique indexes reject duplicates in both scopes. |
| Tie resolution step order/types | Regulation/penalties steps accepted; duplicate position and removed away-goals type rejected. Whole sequence validation is later Format command logic. |
| One Match per Fixture Slot | First Match accepted; duplicate rejected. |
| Exactly one Fixture Slot specialization | Specialized fixtures accepted; missing specialization rejected at deferred check. |
| No participant schedule overlap | First occupancy accepted; overlapping occupancy rejected by GiST exclusion. |
| Field overlap override | Intentionally not a DB exclusion: a reasoned Admin override must remain possible. Locked field validation and reason logging are later schedule commands. |
| Finished iff Official Result | Finished without result rejected; played-result Match reaches Finished with a current pointer. |
| Official Result one source | Played and Technical Results exercised by the public-query fixture; source-less version rejected. |
| Shootout only on played result | Played Result with shootout accepted; shootout with Technical Result rejected. Decisive-Tie semantics are later sporting command validation. |
| Nonnegative goals/cards | Valid played score accepted; negative goals and disciplinary counts rejected. |
| No overlapping Player registration | First approved period accepted; overlapping period rejected by GiST exclusion. |
| One Season Entry per Team/Season | First Entry accepted; duplicate rejected. |
| Roster limits and Legionnaire quota | Date and FK storage exists; actual count/rule revalidation requires later roster registration commands and ordered Player/Roster locks. |
| One non-revoked Admin Grant | Active Grant accepted; second active/suspended Grant rejected. Last-Active-Admin policy is later identity command logic. |
| No duplicate command/job/webhook and no duplicate claim | Scoped unique keys reject repeated command, job, and webhook; two concurrent workers claim each queue row at most once. Payload-hash replay behavior is later command logic. |
| Published revision reproducible | Current revision pointers and immutable histories are tested; publication + Audit + outbox atomicity is tested as a rollback boundary, while full publication commands are later. |
| Former slug never reused | First normalized slug accepted; reuse by another Competition rejected. Redirect resolution is later public routing logic. |
| Legal Hold blocks deletion | FK and target lookup index exist, but generic target IDs cannot give a universal FK. Mandatory active-hold lookup before resource deletion belongs to later resource-specific deletion commands; no deletion command may ship without its positive/negative Legal Hold test. |

## Forward upgrade rehearsal

Migration `0001_current_participant_uniqueness.sql` was also applied to an isolated clone of the deterministic Golden Season database at the preceding schema revision. The clone's migration ledger advanced from one row to two, and both backfill mismatch counts were zero. This exercises existing Stage assignments and Knockout Tie slots rather than only empty-table installation. The original `proleague_golden_seed` database was not changed. The repeatable PR upgrade job and read-only drift comparison are tracked by #77.
