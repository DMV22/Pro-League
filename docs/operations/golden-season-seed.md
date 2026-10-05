# Disposable Golden Season seed

Issue [#75](https://github.com/DMV22/Pro-League/issues/75) provides a fictional, deterministic PostgreSQL fixture for Local, CI, and a future isolated Preview database. It is not federation data and is never imported from the retired Redux simulator.

## Safety boundary

- The command reads **only** `SEED_DATABASE_URL`; it never falls back to `DATABASE_URL` or `MIGRATION_DATABASE_URL`.
- Local requires the exact database name `proleague_golden_seed` on a loopback host; CI requires `proleague_golden_seed_ci` on loopback. Preview requires `proleague_golden_seed_pr_<PR number>` and `--preview-pr=<same number>`.
- Every run requires `--confirm-db=<exact database name>`. The normal local `proleague` database and any Production database are rejected before a connection is made.
- Initial seed refuses a non-empty application schema. `--reset` deletes **all application data in that dedicated disposable database only**, then seeds again in one transaction. It preserves `app.__drizzle_migrations`. Do not put hand-entered or real data in a Golden Season database.
- The reset temporarily disables immutable-history triggers only inside the transaction on the exact approved disposable database. A failed run rolls back both data and trigger changes.
- Production never runs this command automatically. Preview database provisioning and removal belong to the later isolated Preview workflow; the current M1 Render Service Preview remains application-only.

## Local setup (PowerShell)

Start the existing PostgreSQL container, then create a separate empty database once. Change the username if your local `.env.local` uses a different one:

```powershell
pnpm db:up
docker compose --env-file .env.local -f compose.postgres.yaml exec -T postgres psql -U proleague -d postgres -c "CREATE DATABASE proleague_golden_seed"
```

Set both URLs in the **current terminal session** to your private local PostgreSQL connection string ending in `/proleague_golden_seed`. Do not commit the URLs or paste credentials into an issue. `MIGRATION_DATABASE_URL` is used only for the reviewed schema migration; `SEED_DATABASE_URL` is used only for the fixture.

```powershell
$env:MIGRATION_DATABASE_URL = 'postgresql://<user>:<password>@127.0.0.1:<port>/proleague_golden_seed'
$env:SEED_DATABASE_URL = $env:MIGRATION_DATABASE_URL
pnpm db:migrate:local
pnpm db:seed-golden --target=local --confirm-db=proleague_golden_seed
pnpm db:verify-golden --target=local --confirm-db=proleague_golden_seed
```

To deliberately replace this disposable database's application data:

```powershell
pnpm db:seed-golden --target=local --confirm-db=proleague_golden_seed --reset
pnpm db:verify-golden --target=local --confirm-db=proleague_golden_seed
```

CI uses the same commands with `--target=ci --confirm-db=proleague_golden_seed_ci` against a separately migrated local CI database. An isolated PR Preview uses `--target=preview --preview-pr=<number> --confirm-db=proleague_golden_seed_pr_<number>` and a correspondingly named database. Do not point a Preview command at shared or Production infrastructure.

## What is represented

The fixed fixture includes four fictional teams; league and completed group stages; fixed and redrawn knockout rounds; one- and two-leg ties, direct penalties, a bye and third-place match; a Rest Slot, alternate home field, postponement and schedule revision; a played score superseded by a 0:3 Technical Result; unresolved progression; completed standings and knockout snapshots; roster windows, a transfer, Legionnaire classification with a 1991 birth-date cutoff, and a restricted minor; plus Draft, Scheduled, Published/corrected, and Archived articles.

Media rows are **metadata-only synthetic examples**. The seed does not upload binary objects or make a real storage URL available; a future Preview/storage integration must provision a real synthetic object before rendering that image. The verification command checks the reviewed migration ledger, critical relationships, and a version-controlled stable digest. Two clean databases and any successful reset must produce the same digest.
