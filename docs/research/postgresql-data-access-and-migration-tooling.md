# PostgreSQL data-access and migration tooling

## Scope and decision context

This report answers GitHub issue #22: which TypeScript data-access and schema-migration tooling best fits ProLeague's accepted modular monolith, and which database rules must remain explicit PostgreSQL SQL.

The repository is still the Vite learning prototype and has no database dependency. The target is one Next.js 16 application on the Node.js runtime, one authoritative PostgreSQL database, framework-neutral domain and application modules, module-owned writes, cross-module read projections, optimistic aggregate versions, short ordered locks, atomic Audit Events and a transactional outbox. Deployments must use backward-compatible migrations, separate environments, restore testing, and a low operating budget. These are accepted ProLeague constraints from ADR-0011, ADR-0020, ADR-0021, and ADR-0022, not claims made by the tooling vendors.

The evaluated options are:

1. Prisma ORM with Prisma Migrate;
2. Drizzle ORM with Drizzle Kit;
3. Kysely with its migrator or a separate PostgreSQL migration runner;
4. direct `node-postgres` (`pg`) with `node-pg-migrate` as the representative SQL-first migration approach.

Only official documentation and source repositories are used below. Statements under **Source facts** describe documented product behavior. Statements under **ProLeague assessment** are architectural inferences for this repository.

## Recommendation

Use **Drizzle ORM over `node-postgres`, with Drizzle Kit generating version-controlled SQL migrations**. Treat the generated SQL, not `push`, as the deployable artifact. Review every migration and edit or add custom SQL whenever a PostgreSQL capability cannot be represented faithfully by the Drizzle schema.

This is the best fit because it combines:

- compile-time table, column, selection, and mutation typing without generated domain entities;
- a PostgreSQL-shaped query API and parameterized `sql` escape hatch;
- interactive transactions and PostgreSQL isolation configuration;
- first-class definitions for ordinary `CHECK`, foreign-key, unique, partial/expression index, operator-class, and concurrent-index cases;
- inspectable SQL migrations and no required hosted data service;
- a thin persistence layer that can remain behind ADR-0021 repository and Query Layer ports.

The recommendation is conditional on a strict migration policy: use a pinned stable release; never use `drizzle-kit push` on shared, staging, or production databases; run migrations once as a deployment job; test them against real PostgreSQL; and add an explicit drift check because Drizzle Kit's documented `check` command checks migration collisions, not live-database drift ([Drizzle Kit overview](https://orm.drizzle.team/docs/kit-overview), [Drizzle FAQ](https://orm.drizzle.team/docs/faq)).

## Comparison matrix

| Criterion | Prisma ORM | Drizzle ORM | Kysely | `pg` + `node-pg-migrate` |
| --- | --- | --- | --- | --- |
| Next.js Node runtime | Supported Node client; current driver-adapter architecture works through `pg` | Native `node-postgres` integration | Built-in PostgreSQL dialect uses a `pg` pool | Native target |
| Serverless shape | Supported, but pool sizing and client reuse still matter | Multiple TCP/serverless drivers; transaction capability depends on transport | Runs in Node and worker runtimes; dialect/driver determines connection behavior | Works in Node functions; application owns pooling |
| Transactions/isolation | Interactive and sequential transactions; configurable isolation | Callback transactions, savepoints, isolation/access/deferrable config | Callback transactions and configurable isolation/access mode | Manual `BEGIN`/`COMMIT`/`ROLLBACK` on one checked-out client |
| OCC | Documented version-token pattern | Straightforward conditional update; no special OCC feature | Straightforward conditional update; no special OCC feature | Fully manual |
| Row/advisory locks and outbox claim | Raw/TypedSQL for PostgreSQL-specific forms | Parameterized SQL where builder API is insufficient | First-class `forUpdate`, `skipLocked`, `noWait`; raw SQL otherwise | Direct SQL |
| Advanced PostgreSQL schema | Some features require edited migrations | Broad index/constraint DSL; exclusion constraints still require SQL | Schema builder plus SQL; no schema-to-migration diff | Full SQL control |
| Migration SQL review | Generated SQL is editable | Generated SQL is the normal code-first artifact | Hand-authored TS/SQL migrations | Hand-authored TS/SQL migrations |
| Drift detection | Strong development drift detection through a shadow DB; production deploy does not provide the same check | No documented live production drift check in `check` | No schema-diff/drift system in the core migrator | No built-in schema-diff/drift system |
| Type source | Generated client from Prisma schema | TypeScript table schema | Manually supplied/generated `Database` interface | Manually declared result types or another generator |
| Runtime footprint | Generated client/query compiler plus driver adapter; modern versions can omit Rust binaries | Vendor describes it as a thin TypeScript layer | Official site states zero runtime dependencies | Small low-level driver plus migration dev dependency |
| Vendor neutrality | Standard PostgreSQL underneath, but application queries and schema use Prisma-specific APIs | Standard driver and reviewable SQL; moderate API coupling | Highest query-layer portability and SQL transparency | Highest SQL transparency, lowest application type assistance |
| ProLeague fit | Good productivity, weaker representation of PostgreSQL-specific invariants | **Best balance** | Strong runner-up for an SQL-expert team | Too much repetitive infrastructure for the default layer |

## Prisma ORM

### Source facts

Prisma Client is a generated type-safe query client. Current documented versions can run without Rust engine binaries by using the JavaScript driver-adapter architecture; PostgreSQL uses `@prisma/adapter-pg`, which delegates connection pooling to `pg` ([generating Prisma Client](https://docs.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/generating-prisma-client), [database drivers](https://docs.prisma.io/docs/orm/v7/core-concepts/supported-databases/database-drivers)). This removes the former binary-deployment objection, although it does not remove generated code or query compilation.

Prisma supports interactive transactions and transaction isolation configuration. Its official transaction guide documents optimistic concurrency through a version field included in the update predicate, available for non-unique filters in updates since Prisma 5.0 ([transactions and optimistic concurrency](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions)).

Prisma offers parameterized raw query methods and TypedSQL. TypedSQL generates typed functions from `.sql` files; the legacy raw methods remain available where dynamic SQL or unsupported database types require them ([TypedSQL](https://docs.prisma.io/docs/orm/v6/prisma-client/using-raw-sql/typedsql), [raw queries](https://www.prisma.io/docs/orm/v6/prisma-client/using-raw-sql/raw-queries)).

Prisma schema supports common primary, foreign-key, unique, and index declarations and several PostgreSQL index methods. Partial indexes are documented behind a Preview feature in the current schema reference. Features without a Prisma Schema Language representation must be added by generating a migration with `--create-only`, editing its SQL, applying it, and committing that SQL ([indexes](https://docs.prisma.io/docs/orm/prisma-schema/data-model/indexes), [unsupported database features](https://docs.prisma.io/docs/orm/prisma-migrate/workflows/unsupported-database-features)).

`prisma migrate dev` replays migration history into a shadow database to detect development schema drift and potential data loss. The shadow database is not used by production-focused commands such as `migrate deploy` ([shadow database](https://docs.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/shadow-database)). Production migrations are intended to run from CI/CD with `prisma migrate deploy`; Prisma also documents the expand-and-contract pattern for compatible data changes ([deploying migrations](https://docs.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate), [expand and contract](https://www.prisma.io/docs/guides/database/data-migration)). Seeding is an explicit command in Prisma 7 and can be used to prepare test databases ([seeding](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/seeding)).

### ProLeague assessment

Prisma has the most guided model-centric developer experience and the strongest built-in development drift workflow in this comparison. It is viable for ProLeague if all persistence stays inside infrastructure repositories and the team accepts a permanent custom-SQL layer.

It is not the preferred option because several central ProLeague operations are PostgreSQL-shaped rather than CRUD-shaped: ordered row locks, transaction-scoped advisory locks, `FOR UPDATE SKIP LOCKED` outbox claiming, range/exclusion constraints, and carefully staged online DDL. Prisma can execute them, but they become exceptions alongside a separate schema language. Preview-only partial indexes should not carry critical production invariants. This makes the database contract easier to misunderstand than with Drizzle's SQL-shaped API and SQL migration workflow.

The project must also pin a Prisma major rather than combining guidance from different generations: Prisma 8's official pages describe a substantially revised contract and graph-based migration architecture that is still marked with incomplete pieces, while the mature Prisma 7 workflow uses Prisma Migrate ([Prisma ORM documentation](https://www.prisma.io/docs/orm), [Prisma 7 overview](https://docs.prisma.io/docs/orm/v7)).

## Drizzle ORM and Drizzle Kit

### Source facts

Drizzle has native PostgreSQL integrations for `node-postgres` and Postgres.js, as well as provider-specific serverless transports. Its Neon documentation distinguishes stateless HTTP, which is suited to single non-interactive transactions, from WebSocket/`pg`-compatible transports needed for interactive transaction semantics ([PostgreSQL connection](https://orm.drizzle.team/docs/get-started-postgresql), [Neon connection](https://orm.drizzle.team/docs/connect-neon)). Therefore, runtime compatibility and transaction capability are partly a driver choice, not an ORM guarantee.

Drizzle callback transactions support nested savepoints and PostgreSQL-specific `isolationLevel`, `accessMode`, and `deferrable` settings ([transactions](https://orm.drizzle.team/docs/transactions)). Its parameterized `sql` template can be used as a whole query or embedded in selects, predicates, ordering, grouping, and other builder clauses. The generic argument to `sql<T>` is only a compile-time assertion and performs no runtime mapping ([SQL operator](https://orm.drizzle.team/docs/sql)).

The PostgreSQL schema DSL documents `CHECK`, primary, composite primary, foreign-key, and unique constraints. Its index API supports sort/null behavior, expressions, partial predicates, operator classes, access methods, `CONCURRENTLY`, and storage parameters ([indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints)). No first-class exclusion-constraint API is documented there, so exclusion constraints must be custom SQL.

Drizzle Kit supports multiple migration strategies. In the recommended code-first/reviewable-SQL flow, `generate` compares schema snapshots and writes SQL migration files, and `migrate` applies unapplied files recorded in a database migration table ([migration fundamentals](https://orm.drizzle.team/docs/migrations), [`migrate`](https://orm.drizzle.team/docs/drizzle-kit-migrate)). The official FAQ advises caution with `push`, recommends it only for local databases, and documents gaps when changing expression, predicate, and operator-class fields through `push`; those specific gaps do not apply to `generate` ([Drizzle FAQ](https://orm.drizzle.team/docs/faq)). Drizzle Kit's `check` command is documented as checking generated migrations for branch collisions, not comparing a live production schema with migration history ([Drizzle Kit overview](https://orm.drizzle.team/docs/kit-overview)).

### ProLeague assessment

Drizzle table objects are infrastructure schema, not domain models. Each module should export repositories and application ports, not its Drizzle tables. A transaction adapter should pass a transaction-scoped repository set to orchestrators so one accepted decision can atomically update multiple owning modules, append its Audit Event, and write outbox messages without allowing arbitrary cross-module table writes.

OCC needs no special ORM primitive: issue one typed `UPDATE` constrained by stable ID and expected `version`, increment the version in the same statement, use `RETURNING`, and treat zero affected rows as a conflict. Keep the check inside the transaction that also writes Audit History and outbox work.

The lack of a documented live drift detector is manageable for this low-traffic system only if compensated by process: migration-ledger verification on deploy, a clean-install test from an empty database, an upgrade test from the previous release, and a separately scheduled schema comparison or audited `pg_dump --schema-only` baseline for staging/production. That comparison is a proposed ProLeague control, not a Drizzle feature.

## Kysely

### Source facts

Kysely is a type-safe SQL query builder rather than a model ORM. It infers selected result shapes from a supplied database interface and officially supports Node, Deno, Bun, Workers, and browsers; its official site states that the core has zero runtime dependencies ([Kysely site](https://www.kysely.dev/), [source repository](https://github.com/kysely-org/kysely)). The built-in PostgreSQL dialect consumes a `pg`-compatible pool without taking a direct dependency on `pg` ([PostgreSQL dialect configuration](https://github.com/kysely-org/kysely/blob/master/src/dialect/postgres/postgres-dialect-config.ts)).

Kysely supports callback transactions with isolation and access-mode configuration ([TransactionBuilder](https://kysely-org.github.io/kysely-apidoc/classes/TransactionBuilder.html)). Its select builder has explicit `forUpdate`, `forShare`, `skipLocked`, and `noWait` methods, which map well to locked workflows and queue claiming ([SelectQueryBuilder](https://kysely-org.github.io/kysely-apidoc/interfaces/SelectQueryBuilder.html)). The parameterized `sql` tag is the general escape hatch; its `raw`, identifier, and literal helpers explicitly warn when unchecked input can cause injection ([SQL API](https://kysely-org.github.io/kysely-apidoc/interfaces/Sql.html)).

Kysely includes a migration runner with migration and lock tables and pluggable migration providers, but it runs authored migrations; it is not a schema-diff generator or drift detector ([Migrator API](https://kysely-org.github.io/kysely-apidoc/classes/migration.Migrator.html), [migrator source](https://github.com/kysely-org/kysely/blob/master/src/migration/migrator.ts)).

### ProLeague assessment

Kysely is the strongest alternative if the maintainer deliberately wants SQL-first repositories and is comfortable owning schema types/code generation, migration authoring, drift checks, and relation mapping separately. Its explicit lock API is better than Drizzle's for ADR-0021 workflows.

It is rejected as the default because ProLeague starts without a database layer and will have a large relational schema. Adding a separate source for database types and hand-authoring all migrations creates more setup and synchronization work than Drizzle without enough compensating benefit for the MVP. It remains a plausible future Query Layer tool if Drizzle becomes awkward for complex standings or reporting projections, but introducing two query builders initially would be needless.

## Direct `node-postgres` and `node-pg-migrate`

### Source facts

`node-postgres` is a low-level PostgreSQL driver. It supports parameterized queries, named prepared statements, pools, and custom type parsers ([queries](https://node-postgres.com/features/queries), [types](https://node-postgres.com/features/types)). Transactions are intentionally manual: the application issues `BEGIN`, `COMMIT`, and `ROLLBACK`, and every statement must use the same checked-out client; `pool.query` must not be used for a multi-statement transaction ([transactions](https://node-postgres.com/features/transactions)). Its pool-sizing guidance notes that total connections across function instances and any external pooler must be considered in serverless deployments ([pool sizing](https://node-postgres.com/guides/pool-sizing)).

`node-pg-migrate` is PostgreSQL-focused and supports TypeScript/JavaScript migration definitions plus raw SQL. Its runner records migrations, takes a lock, and by default combines pending migrations into a transaction; it also supports dry runs and opting out of the transaction when PostgreSQL DDL requires it ([repository](https://github.com/salsita/node-pg-migrate), [runner source](https://github.com/salsita/node-pg-migrate/blob/main/src/runner.ts)). It does not document a built-in live-schema drift comparison.

### ProLeague assessment

Direct `pg` provides maximum control but no schema-derived query/result typing, repository conventions, transaction abstraction, or migration/schema synchronization. Building those pieces would recreate a small internal data framework. This is disproportionate for the MVP and increases the chance that a query bypasses module ownership or omits Audit History/outbox work.

Use `pg` as Drizzle's underlying driver, not as a parallel ordinary write path. A narrowly isolated direct-driver adapter is acceptable only if profiling or a driver feature proves Drizzle cannot express a required operation.

`node-pg-migrate` is a reasonable partner for Kysely or direct SQL, but adopting it beside Drizzle Kit would create two migration authorities. ProLeague should have one ordered migration history, so the recommendation keeps Drizzle Kit and puts custom SQL into that history.

## PostgreSQL rules that remain explicit SQL

The following are not optional implementation details. They should appear as named, reviewed SQL migrations or narrowly encapsulated parameterized SQL operations, with integration tests against real PostgreSQL.

1. **Extensions and exclusion constraints.** Enable approved extensions such as `btree_gist` explicitly. Use `EXCLUDE USING gist` with range operators for true non-overlap invariants, such as a Playing Field occupancy window where the final model can express the interval in one row. PostgreSQL documents exclusion constraints specifically for preventing overlapping ranges ([range constraints](https://www.postgresql.org/docs/current/rangetypes.html)). Domain validation still provides useful errors; the constraint closes concurrency races.
2. **Transaction-scoped advisory locks.** Use `pg_advisory_xact_lock`/`pg_try_advisory_xact_lock` with a documented stable key derivation for cross-aggregate invariants that do not map cleanly to one row. Transaction-level advisory locks are automatically released at transaction end, unlike session-level locks ([explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)).
3. **Ordered row locking.** Express the exact `SELECT ... FOR UPDATE`/`FOR NO KEY UPDATE` order for Current Season changes, roster transfers, finalization, last-Admin protection, and bulk schedule publication. Locks last until transaction end and inconsistent acquisition order can deadlock ([explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)).
4. **Atomic outbox and scheduled-work claiming.** Use one statement or transaction that selects eligible rows with `FOR UPDATE SKIP LOCKED`, marks the claim, and returns the claimed records. PostgreSQL warns that `SKIP LOCKED` is unsuitable for general reads but appropriate for queue-like multi-consumer access ([`SELECT`](https://www.postgresql.org/docs/current/sql-select.html)).
5. **Online migration operations.** Write explicit expand-contract steps for nullable/additive expansion, backfill, application switchover, validation, and later contraction. Use `NOT VALID` followed by `VALIDATE CONSTRAINT` where appropriate, and `CREATE INDEX CONCURRENTLY` for populated high-impact tables after measuring the lock risk. PostgreSQL documents that validation avoids blocking concurrent updates and that concurrent index creation avoids write-blocking, with different transactional constraints ([`ALTER TABLE`](https://www.postgresql.org/docs/current/sql-altertable.html), [`CREATE INDEX`](https://www.postgresql.org/docs/current/sql-createindex.html)).
6. **Constraint and index details not faithfully represented by the schema DSL.** This includes deferrable constraints, exclusion constraints, extension-backed operator classes, specialized expression/predicate cases, database roles/grants, and any append-only database protection accepted for Audit History. Do not approximate a critical invariant merely to keep it in the ORM DSL.
7. **Retry classification.** Map SQLSTATE `40001` and, for idempotent commands, `40P01` to a bounded retry of the complete transaction. Do not broadly retry stale versions, validation failures, or every unique/exclusion violation. PostgreSQL requires retrying the complete transaction and warns that unique/exclusion failures need case-specific judgment ([serialization failure handling](https://www.postgresql.org/docs/current/mvcc-serialization-failure-handling.html)).

Ordinary primary keys, restrictive foreign keys, non-preview unique constraints, `CHECK` constraints, and straightforward indexes should be declared in Drizzle's schema and verified in the generated SQL. Partial/expression indexes may also use the stable Drizzle API, but their generated SQL remains a review target. Cross-module foreign keys must use restrictive deletion in accordance with ADR-0021; ORM relation helpers never authorize cross-module mutation or cascading deletion.

## Migration and test workflow

The following is the recommended ProLeague workflow; it is an architectural proposal derived from the documented capabilities above.

1. Keep one ordered `drizzle/` migration history in source control. Generate a migration, inspect the SQL, add explicit SQL where required, and never edit an already deployed migration.
2. Run `drizzle-kit migrate` exactly once in a deployment/release job before compatible application code receives traffic. Do not run migrations from every Next.js process or function invocation.
3. Use expand-contract across releases. A rollback deploy must remain compatible with the expanded schema; destructive contraction occurs only after the old code is gone, verification passes, and ADR-0020's backup requirement is met.
4. In CI, start a real supported PostgreSQL instance, apply every migration to an empty database, run schema/constraint tests, seed synthetic fixtures, and run repository/integration tests. Also restore the previous release schema, apply only pending migrations, and run both compatibility and data-backfill assertions.
5. Give every developer/test run an isolated database or PostgreSQL schema. Never reuse Production Player data; use deterministic synthetic data.
6. Verify migration ledger consistency at deployment. Add a staging/production drift control before launch, because Drizzle Kit does not document live drift detection. The exact control may be a normalized schema dump comparison or a separate inspect/diff tool, but it must be read-only and must not become a second migration authority.
7. Test the actual PostgreSQL error mapping for unique, check, foreign-key, exclusion, serialization, deadlock, and lock-timeout cases. Repositories translate these into typed application outcomes without leaking Drizzle rows or vendor errors into domain modules.
8. Test an outbox worker with at least two concurrent consumers and repeated delivery. Prove claim exclusivity, transaction rollback, idempotency, retry exhaustion, and reconciliation behavior.

## Rejected alternatives

- **Prisma ORM + Prisma Migrate:** rejected as the default because ProLeague's consistency model requires enough PostgreSQL-specific SQL that Prisma's separate schema abstraction would frequently be incomplete. It remains acceptable if the team prioritizes generated model CRUD and accepts custom SQL, a pinned mature major, and an additional production drift control.
- **Kysely + Kysely migrator or `node-pg-migrate`:** rejected for the MVP because it requires more separately maintained schema typing/migration infrastructure. Prefer it only if the maintainer explicitly chooses an SQL-first development style.
- **Direct `pg` + `node-pg-migrate`:** rejected as the default because it shifts type-safe result mapping, transaction safety, schema synchronization, and repository conventions into project code.
- **Drizzle `push` as deployment mechanism:** rejected for all shared environments. Official guidance limits it to local workflows, and production changes must remain ordered, reviewable, reproducible, and compatible.
- **A second migration authority solely for drift detection:** rejected. A read-only checker may be added, but it must not apply schema changes or maintain a competing migration history.

## Open user decisions

1. **Approve Drizzle or choose the Prisma productivity trade-off.** Recommendation: Drizzle. Choose Prisma only if generated CRUD/relations are valued more than PostgreSQL schema transparency.
2. **Choose the exact stable version at implementation time.** Recommendation: pin the latest stable Drizzle ORM/Kit pair and `pg`; do not adopt an RC or preview feature for a critical invariant. Current Drizzle pages visibly advertise an approaching v1 and some connection examples use `@rc`, so the exact pin must be verified when implementation starts ([Drizzle documentation](https://orm.drizzle.team/docs/overview)).
3. **Select the production drift control before launch.** Recommendation: begin with migration-ledger checks plus a normalized read-only schema comparison in staging; require the same check after restore. Evaluate a dedicated tool only if this proves unreliable.
4. **Choose database-per-module naming.** Recommendation: one PostgreSQL schema initially, with table/migration names prefixed or grouped by owning module in code. Separate PostgreSQL schemas add operational friction and do not enforce application-layer ownership by themselves.
5. **Define which overlap invariants become exclusion constraints.** Recommendation: prototype Playing Field occupancy first. Some rules depend on statuses, overrides, or multiple rows and may require locks plus validation rather than one declarative constraint.
6. **Choose deployment topology before pool values.** Recommendation: `pg` through Drizzle on the Node runtime, with one process-level pool per warm instance and a provider pooler when the selected serverless/auto-scaling host requires it. Set limits only after the host and PostgreSQL connection budget are known.

## Decision-ready summary

Adopt Drizzle ORM + Drizzle Kit + `pg`, with SQL migrations as the review and deployment boundary. Keep Drizzle entirely inside infrastructure. Expose module repositories, a transaction abstraction, and purpose-built Query Layer view models; never expose Drizzle table/row types as domain contracts. Implement OCC as an atomic expected-version update, make Audit Event and outbox writes part of the same transaction, and use explicit PostgreSQL SQL for exclusions, advisory/row locks, outbox claims, online DDL, and other advanced invariants.

This choice is provider-neutral at the data level, cheap to operate, compatible with the accepted Next.js Node runtime, and faithful to ADR-0021's ownership and consistency boundaries. Its main deficit is live drift detection, which must be closed deliberately before production rather than assumed to exist.
