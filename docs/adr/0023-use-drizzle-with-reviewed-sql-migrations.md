---
status: accepted
---

# Use Drizzle with reviewed SQL migrations

ProLeague will use Drizzle ORM and Drizzle Kit over the node-postgres driver. Drizzle provides a typed PostgreSQL-shaped persistence layer without becoming a domain model, while version-controlled and reviewed SQL migrations preserve the explicit database control required for module ownership, advanced constraints, locking, audit, outbox, and safe deployment. The comparison with Prisma, Kysely, and direct node-postgres is retained in [the PostgreSQL tooling research](../research/postgresql-data-access-and-migration-tooling.md).

## Persistence boundary

Drizzle is confined to infrastructure repositories, a shared transaction adapter, and the read-only Query Layer. Drizzle tables, relations, rows, and vendor errors are never exposed as domain or application contracts. Application orchestrators receive transaction-scoped owning repositories so one accepted decision can update multiple modules, append its Audit Event, and enqueue outbox work atomically.

Parameterized SQL executes through the Drizzle transaction or executor. Direct node-postgres is not a parallel write path; a narrowly isolated driver adapter is allowed only after a demonstrated technical limitation and remains inside the owning repository.

Optimistic concurrency uses an atomic update constrained by stable ID and expected version, increments the version, and treats no returned row as a conflict. Infrastructure maps unique, check, foreign-key, exclusion, serialization, deadlock, and timeout failures into typed application outcomes rather than leaking database errors to the UI.

The application pins a mutually compatible stable Drizzle ORM, Drizzle Kit, and node-postgres set at implementation time. Release candidates, beta versions, and preview-only features cannot carry critical production invariants. Pool limits are selected with the later hosting topology; each warm Node instance reuses one pool and uses a provider pooler when required by the connection budget.

## Database contract

Drizzle TypeScript schema is the current application-facing description for supported structures. One committed SQL migration timeline is the complete deployment history and contains every custom PostgreSQL operation. The project uses one PostgreSQL application schema and one migration history; module ownership is expressed by schema files, repositories, and review rather than separate database schemas.

Ordinary primary keys, restrictive foreign keys, unique and check constraints, and supported indexes are declared in Drizzle and verified in generated SQL. Explicit reviewed SQL remains mandatory for:

- extensions, range and exclusion constraints;
- transaction-scoped advisory locks and exact ordered row-lock statements;
- atomic outbox and scheduled-job claims using queue-appropriate locking;
- online migration steps, deferred constraints, specialized indexes, predicates, and operator classes;
- database roles and grants plus append-only Audit History protection;
- bounded SQLSTATE retry classification.

The relational-schema decision determines which concrete domain invariants use these mechanisms. No invariant may be weakened merely to fit the ORM DSL.

## Migration authority and lifecycle

Drizzle Kit generates SQL and metadata that are reviewed and committed together with the TypeScript schema. Direct schema push is allowed only for disposable local exploration and is prohibited for Development, CI, Preview, Staging, and Production. Those environments apply the committed migration history through one locked release job; application startup, Server Actions, and requests never run migrations.

A migration and its Drizzle snapshot become immutable after being applied to any shared environment. Corrections use a new migration. The initial migration must reproduce the entire schema from an empty supported PostgreSQL instance without a fake baseline or manual prerequisite.

Each migration describes one coherent schema change or one expand-contract phase. Cross-module changes are allowed only for one atomic invariant and identify every affected module. Production evolution proceeds forward through additive expansion, optional backfill, application switchover, verification, and later destructive contraction. Application rollback remains compatible with the expanded schema; database corrections use new forward migrations rather than automated down migrations.

Small deterministic backfills may be reviewed migration SQL. Large, slow, or retryable backfills are versioned idempotent application jobs with explicit progress and verification between expand and contract releases. Non-transactional DDL, including concurrent index creation, runs as a separate resumable deployment step with pre- and post-checks.

Production migrations set bounded lock and statement timeouts and fail safely instead of waiting indefinitely against Portal traffic. High-risk changes require the agreed backup and recovery plan. Manual Production DDL is prohibited; emergency Break-glass DDL requires an Incident Record, a follow-up reconciliation migration, and drift verification.

## Drift and verification

Deployment verifies the migration ledger. CI applies every migration to an empty PostgreSQL database, upgrades a database at the previous release, executes deterministic synthetic seeds, and tests repositories, constraints, lock ordering, transaction rollback, data backfills, and concurrent idempotent outbox consumers against the same PostgreSQL major version used in Production. SQLite and PGlite are not acceptance substitutes for PostgreSQL behavior.

CI repeats schema generation and rejects unexplained changes to generated SQL or Drizzle metadata. A read-only drift control builds a reference database from committed migrations and compares its normalized schema-only dump with Staging and, after deployment or restoration, Production. Schema dumps omit ownership and privilege noise, use a pg_dump version compatible with the server, and keep every normalization exception explicit.

A migration is accepted only after SQL review, clean installation, previous-release upgrade, constraint and lock tests, backfill verification, repeat deployment, compatibility with both application sides of expand-contract, drift comparison, application rollback rehearsal, and a documented database recovery path.

Development, CI, and Preview use deterministic synthetic fixtures and never Production Player data. Production seeding is not automatic; initial reference data and first-Admin bootstrap are separate explicit operational commands with their own audit and reconciliation rules.

## Rejected alternatives

Prisma is not the default because the accepted consistency model requires frequent PostgreSQL-specific SQL outside its separate schema abstraction. Kysely is not the default because it would require additional schema typing, migration authoring, and synchronization infrastructure at the start of a large relational model. Direct node-postgres would shift too much type safety and transaction discipline into project code. A second tool may inspect drift read-only but cannot apply changes or maintain a competing migration history.
