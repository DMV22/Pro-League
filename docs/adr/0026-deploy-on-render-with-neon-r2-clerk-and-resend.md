---
status: accepted
---

# Deploy on Render with Neon, R2, Clerk, and Resend

ProLeague will deploy its single Next.js modular monolith as one Render Starter web service in Frankfurt, use one Render Cron dispatcher for scheduled work, Neon Launch PostgreSQL in Frankfurt as the authoritative store, Cloudflare R2 EU for public, private, and operational objects, Clerk Hobby for invite-only Admin authentication, and Resend Free for transactional email. This managed hybrid was selected over Vercel Pro, a cohesive Render database stack, and a self-managed VPS because it preserves standard Node.js, PostgreSQL, and S3 boundaries while reaching an estimated USD 13 minimum and approximately USD 23 planned monthly cost with substantially less operational ownership than a VPS.

## Consequences

The Render-to-Neon connection crosses the public network over TLS. Runtime and dispatcher connections use a pooled least-privilege URL; migrations and encrypted `pg_dump` exports use distinct direct credentials. One web instance uses the default in-memory Next.js cache, while PostgreSQL remains canonical; adding another instance requires a shared cache and invalidation review. Image uploads bypass web-process buffering, and bounded derivative processing plus the 512 MB Render memory limit must pass launch testing.

One five-minute dispatcher claims idempotent leased PostgreSQL jobs for outbox delivery, media work, daily backup, log export, and cleanup. Neon supplies a seven-day restore window; encrypted R2 archives retain 14 daily and six monthly database copies. RPO of 15 minutes, RTO of four hours, and the 99.5% public SLO are internal objectives proven through monitoring and isolated quarterly restore drills, not vendor-backed guarantees.

Local Development remains free. Shared Staging uses isolated free-tier resources and synthetic data, while Production uses separate accounts, databases, buckets, keys, webhooks, and secrets. The deployment path is feature branch to `develop` Staging, then reviewed `develop` to `main` with manual Production approval, a locked pre-deploy migration, health verification, and code rollback without automatic database down-migration.

The detailed topology, failure behavior, credential boundaries, backup policy, observability, ownership transition, and release acceptance gates are recorded in [the production infrastructure blueprint](../architecture/production-infrastructure.md); provider and price evidence remains in [the infrastructure research](../research/production-infrastructure-options.md).
