# PostgreSQL PR gates

Issue [#77](https://github.com/DMV22/Pro-League/issues/77) adds two stable PR check names in `pr-baseline.yml`: `postgres-integration` and `migration`. Both use a disposable PostgreSQL 18 container, synthetic credentials, and exact CI database names on loopback. They do not connect to Render or require Production secrets. Documentation-only PRs report successful no-op checks so the branch ruleset does not wait for absent statuses.

`postgres-integration` applies the committed migrations to an empty database, verifies the Drizzle ledger against the journal and SQL hashes, then runs the real constraint, repository, transaction, lock, and public-query integration suite. `migration` independently tests empty installation, a second no-op application, generated SQL and metadata synchronization, deterministic Golden Season installation and reset, and a populated `0000` to `0001` upgrade. It compares read-only schema-only dumps of a freshly migrated reference database and the seeded database. That comparison detects unintended schema changes during seed execution; `db:generate` and the Git diff check separately detect drift between the TypeScript schema and committed migration artifacts. No CI step uses Drizzle `push` or a down migration.

The checked upgrade pair is deliberately explicit in `prepare-upgrade-rehearsal.ts`. When a new migration is added, the rehearsal fails until its predecessor and populated-fixture assertions are reviewed and updated. Migration `0000` itself had no preceding project schema, so a pre-`0000` upgrade is not applicable; its empty installation is the relevant proof.

## Local reproduction

Use only a dedicated disposable container and the exact CI database names. The following PowerShell example creates a separate Compose project on port 5435; it does not touch the ordinary `.env.local` PostgreSQL container:

```powershell
$env:CI_POSTGRES_DB = 'proleague_integration_ci'
$env:CI_POSTGRES_USER = 'proleague'
$env:CI_POSTGRES_PASSWORD = 'ci-only-postgres'
$env:CI_POSTGRES_PORT = '5435'
$env:MIGRATION_DATABASE_URL = 'postgresql://proleague:ci-only-postgres@127.0.0.1:5435/proleague_integration_ci'
$env:INTEGRATION_DATABASE_URL = $env:MIGRATION_DATABASE_URL
docker compose -p proleague-ci-integration -f compose.postgres.ci.yaml up -d --wait
pnpm db:migrate:local
pnpm db:verify-ledger --confirm-db=proleague_integration_ci
pnpm db:integration --target=ci --confirm-db=proleague_integration_ci
docker compose -p proleague-ci-integration -f compose.postgres.ci.yaml down -v
```

The `migration` job in `.github/workflows/pr-baseline.yml` is the authoritative command sequence for its other disposable databases. Ledger and upgrade commands reject a non-loopback URL, unexpected database name, or missing exact confirmation. The schema-only dumps use the same PostgreSQL 18 `pg_dump` version, omit ownership/privilege/comment noise, and normalize only line endings and PostgreSQL's random `\\restrict` markers. A mismatch reports the first differing normalized line; failed PR runs upload the safe schema dumps as an artifact. Dumps are ignored under `artifacts/`; never put real Player data or credentials into CI artifacts.

## Failure and recovery

If ledger or generated artifacts differ, do not edit a migration already applied in a shared environment. Add a reviewed forward migration, regenerate and commit the SQL plus metadata, then rerun both gates. If a backfill or populated upgrade fails, make the forward migration retryable or correct it with a later migration and retain explicit verification. Do not use automatic destructive down migrations.

For an application rollback after a schema expansion, deploy the previously compatible application version while retaining the expanded database schema. Contracting changes need a later release after the compatibility window. For an incident requiring data recovery, use the environment's backup/restore procedure and verify ledger, schema drift, and application behavior before reopening writes. Never point these CI commands at Development, Preview, or Production databases.

After this PR's CI is green, add the exact `postgres-integration` and `migration` status names to the `develop` branch ruleset as required checks. Do not make them required before the first PR run reports both names.
