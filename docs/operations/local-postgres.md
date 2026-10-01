# Local PostgreSQL 18 and Drizzle tooling

Issue #68 provides a local database and migration tooling, not the application schema. The first reviewed, complete SQL migration is reserved for #72. Do not generate or apply a partial schema migration from this branch.

## Prerequisites

- Node.js 22, pnpm 11, and Docker Desktop with the Linux engine running.
- Port 5432 available on the local machine, or select another `LOCAL_POSTGRES_PORT`.
- No shared or production credentials in local files or terminal output.

## Start and verify

From the repository root in PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local` locally: choose a private password and use the same value in `LOCAL_POSTGRES_PASSWORD`, `DATABASE_URL`, and `MIGRATION_DATABASE_URL`. If the password includes URL-reserved characters, percent-encode it in the two URLs. Keep the port and database/user names consistent across all values. `.env.local` is ignored by Git; never paste its contents into an issue or PR.

```powershell
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:smoke
pnpm db:status
```

`db:smoke` checks a local PostgreSQL 18 connection. `db:status` should say the migration history is not initialized until #72. To stop the container without deleting its data:

```powershell
pnpm db:down
```

The named Docker volume retains local data. Do not run `docker compose down --volumes` unless you intentionally want to erase that database.

## Migration boundary

- `src/server/db/schema.ts` is currently an empty `app` schema namespace. The domain tables will be added in their respective issues.
- `pnpm db:generate` is for generating the first complete migration in #72, followed by review of the emitted SQL and migration journal. Do not use `drizzle-kit push` for shared environments.
- `pnpm db:migrate:local` refuses a non-local migration URL and an absent or empty migration journal. It will become usable after #72 adds a reviewed migration.
- The local bootstrap may use the same PostgreSQL role for runtime and migration URLs. Shared environments require separate least-privilege roles and a direct migrator connection.
- The Next.js process must not run migrations at startup. `DATABASE_URL` is the runtime connection; `MIGRATION_DATABASE_URL` belongs to migration tooling only.
- This task does not provision Neon, Render database credentials, or any paid infrastructure.

If Docker Desktop is not running, start it and repeat `pnpm db:up`. The Docker engine is required for the connection smoke test, but lint, types, unit tests, and build do not require it at this stage.
