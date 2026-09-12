# Production infrastructure blueprint

This blueprint records the implementation-ready hosting and operations design for the ProLeague MVP. It selects managed services but does not provision them; provider prices and limits must be rechecked when Production is created.

## Selected topology

```text
Visitors and Admins
        |
        v
Render Starter Web Service, Frankfurt
  single Next.js Node process
        |
        +--> Clerk Hobby Production -- invited Admin authentication
        +--> Neon Launch, Frankfurt -- authoritative PostgreSQL over TLS
        +--> Cloudflare R2 EU
        |      +-- public-media
        |      +-- private-documents
        |      +-- operations-archive
        +--> Resend -- transactional email

Render Cron, every five minutes
        +--> Neon due-job and outbox claims
        +--> R2 backup and log archives
        +--> Resend/provider effects

External uptime and heartbeat monitor
        +--> public page, health endpoints, Cron heartbeat and alerts
```

The starting Production footprint is exactly one web instance and one Cron service. PostgreSQL remains canonical; Render filesystem and in-memory cache are disposable. A persistent worker, Redis, shared Next.js cache, multiple web instances, or dedicated media processor requires a later capacity decision supported by measurements.

## Cost envelope

| Service | Initial plan | Planning assumption |
| --- | --- | ---: |
| Render web | Starter | USD 7/month |
| Render Cron | usage-based, one service | USD 1/month minimum |
| Neon PostgreSQL | Launch | USD 5/month minimum; about USD 15 typical |
| Clerk | Hobby | USD 0 within plan limits |
| Cloudflare R2 | Standard, EU jurisdiction | USD 0 within low-traffic free allowance |
| Resend | Free | USD 0 within plan limits |
| Uptime/heartbeat monitor | Free tier | USD 0 within plan limits |

The service minimum is approximately USD 13/month and the planning figure is approximately USD 23/month, excluding domain registration, tax, exchange rate, and overages. A USD 20 forecast raises a warning; recurring cost above USD 25 requires explicit approval. Automatic scaling is disabled, unused Preview resources are removed, and actual provider bills are reviewed monthly.

## Environment boundaries

| Boundary | Application | Database | Identity | Objects and email | Scheduling |
| --- | --- | --- | --- | --- | --- |
| Local Development | Local Next.js process | Local PostgreSQL by default; dedicated Neon Free project is optional | Clerk Development | Dedicated development buckets and Resend test credentials | Commands run manually |
| Shared Staging | Render Free web service from `develop` | Dedicated Neon Free project with synthetic data | Separate Clerk Development application | Dedicated staging buckets and credentials | Manually triggered; no paid Cron required |
| Production | Render Starter from `main` | Dedicated Neon Launch project | Clerk Hobby Production | Separate Production buckets, tokens, domain and Resend credentials | One paid Render Cron |

No non-production boundary receives Production secrets, webhooks, private files, or personal data. Staging may sleep, cold-start, reset, or be rebuilt and is never a recovery copy. Pull requests run CI without automatically cloning paid infrastructure; a Preview deployment is created only for a specific review need.

Provider accounts may initially belong to the Technical Operator. Before federation adoption, Production billing and owner access move to federation-controlled accounts or newly created federation resources, and the operator receives an individual account rather than a shared password.

## Region and network

Render web and Cron services and Neon PostgreSQL use Frankfurt. R2 buckets use EU jurisdiction. The Render-to-Neon path is a public provider-to-provider connection protected by TLS, not a private network link.

The web process and dispatcher use separate pooled Neon connection strings and least-privilege PostgreSQL roles. Migrations and logical backups use separate direct connection strings and dedicated roles. Connection pools are process-scoped and bounded; broken outbound connections are discarded, and only safe idempotent operations receive automatic transient retries. Credentials are independent by environment and rotate every 90 days or immediately after suspected exposure.

## Source control and releases

The delivery path is:

1. A feature branch receives local checks and CI.
2. A reviewed pull request merges into `develop` and updates shared Staging.
3. A reviewed pull request promotes `develop` into `main`.
4. A human approves the Production release.
5. One locked pre-deploy job applies the committed backward-compatible Drizzle migration through the direct migration connection.
6. Render activates the new web release only after the migration and health checks succeed.
7. Smoke checks verify a public page, Admin authentication and authorization, PostgreSQL reads, R2 reads, and the dispatcher heartbeat.

Application code may roll back to the previous successful Render deployment. Database migrations do not run down automatically: schema changes follow expand, backfill, switch, verify, and later contract phases so the previous application remains compatible. High-risk data changes require a fresh recovery point and an isolated rehearsal.

A future `render.yaml` declares service type, region, branch, build/start/pre-deploy commands, health check, and environment-variable names. Secret values never enter Git. Provider dashboards that are not fully represented by the Blueprint receive a versioned setup and recovery runbook.

## Scheduled and asynchronous work

One Render Cron service starts every five minutes, connects directly to Neon, atomically claims a bounded set of due jobs with a short lease, performs them, records the outcome, and exits. It does not call the web service merely to reach the database.

The shared job mechanism carries:

- transactional outbox delivery and cache invalidation;
- scheduled publication and notifications;
- bounded media-derivative work;
- the due daily database backup;
- operational-log export and retention cleanup;
- expired upload and other safe maintenance cleanup.

Every job has a deterministic idempotency key, attempt count, next-attempt time, lease owner/expiry, and sanitized outcome. Transient failures use bounded backoff. Five exhausted attempts move a job to dead-letter state and raise an alert; they do not silently discard it. If sustained job volume or duration no longer fits scheduled batches, only then is a persistent worker evaluated.

## Object storage and media

Production uses separate R2 buckets and least-privilege tokens:

- `public-media` contains published variants under immutable versioned keys and is served through `assets.<domain>`;
- `private-documents` contains non-public originals and evidence and has no public bucket access;
- `operations-archive` contains encrypted database backups and privacy-filtered log archives.

An Admin upload uses a short-lived, bounded signed upload URL and sends bytes directly to R2. The server validates the upload metadata and queues bounded derivative creation; a material cannot be published until its required public derivative is ready. The Render web request path never buffers or synchronously transforms a large source image. Peak memory and ordinary traffic must pass within the 512 MB Starter limit before launch.

Private downloads use short-lived signed URLs. Urgent public withdrawal first removes the database reference and origin authorization, invalidates application caches, purges the Cloudflare URL, verifies an uncached request, and then deletes the object. Lifecycle expiration is not treated as an urgent purge mechanism.

## Authentication and secrets

Clerk Hobby Production permits only invited Admin identities; public Visitor accounts and self-registration remain disabled. Every protected server request validates the completed Clerk session and loads its Active PostgreSQL Admin Access Grant. Missing, unmatched, suspended, or revoked state fails closed even if a provider session still exists.

Mandatory MFA and custom session limits are not claimed for the selected plan. Sensitive access-management, Break-glass, private-document bulk export, and security-configuration capabilities remain disabled pending the Security Review defined by ADR-0025. The review is also required before real private documents, a second Admin, federation Production adoption, or after a security incident.

Local secrets live only in an ignored `.env.local`. Production secrets live in the relevant provider secret stores. Separate R2 tokens, pooled runtime URLs, dispatcher credentials, direct migration/backup URLs, Clerk webhook secrets, and Resend credentials receive only the rights they need. Secrets, tokens, signed URLs, private contents, and credentials are excluded from Git, issues, documentation, Audit History, and application logs.

## Backups and recovery

Neon Launch supplies the short seven-day restore/time-travel window. A due daily job uses the direct backup role to create a compressed logical `pg_dump`, encrypts it before upload, and stores it with a checksum and manifest in `operations-archive`. The encryption recovery material is kept outside R2.

Retention keeps the newest 14 successful daily copies and the first successful copy of each month for six months. Backup age and completion are monitored. Before the first Production release, quarterly thereafter, and after material backup or PostgreSQL changes, the Technical Operator restores into an isolated database, verifies schema and representative Official information with an Admin, and records actual recovery point and elapsed time.

The internal objectives are:

- within the Neon restore window, RPO no greater than 15 minutes;
- when only the independent logical archive is available, RPO no greater than 24 hours;
- RTO no greater than four hours for a critical Production recovery.

These are acceptance targets, not provider guarantees. The Portal does not claim them as achieved until a timed drill demonstrates them. Privacy-deletion records are reapplied before restored service reopens, while immutable backups expire on schedule.

## Monitoring and logs

The external monitor checks the public homepage, an Admin entry path, `/health/live`, `/health/ready`, and the dispatcher heartbeat. Liveness reports process availability; readiness verifies required dependencies without returning data or secret detail. Alerts cover failed deployments, database connectivity, dead-letter work, backup age, error rate, latency, storage/capacity, certificate/domain expiry, and projected cost.

Render stdout/stderr remains a short-term diagnostic stream. Durable Audit Events remain in PostgreSQL. Sanitized application errors, Security Events, failed jobs, and material operational events are buffered as structured records and exported daily to R2 for 30 days; raw request bodies, tokens, signed URLs, private document contents, and Player personal data are prohibited. The R2 archive is recoverable evidence, not a searchable log product. A paid indexed service is considered only if operational need justifies it.

Critical alerts go immediately by email to the named Technical Operator. Resend is a fallback for invitation and operational transactional messages, not a marketing platform. Its sending subdomain has SPF, DKIM, and DMARC; failed delivery remains retryable in the outbox.

## Failure behavior

| Failure | Required behavior |
| --- | --- |
| Clerk unavailable | Public reads continue; Admin authentication and protected work fail closed |
| Neon unavailable | Mutations and Admin work stop; already safe cached public content may remain visible with freshness warning |
| R2 unavailable | Text content remains readable with fallbacks; uploads, private downloads, and media-dependent publication stop |
| Resend unavailable | Committed email work remains retryable in the outbox |
| Cron delayed or unavailable | Web reads continue; pending external effects remain visible and alerts fire after heartbeat threshold |
| Migration fails | New release is not activated; prior compatible release continues |
| Cache invalidation fails | Durable retry remains pending; affected freshness and urgent-purge workflows do not report completion |

No privileged mutation succeeds when authorization, required auditing, or schema compatibility is uncertain. The 99.5% public SLO is an internal end-to-end objective and not a composite vendor SLA.

## Portability

The runtime remains standard Next.js on Node.js, persistence uses PostgreSQL through `pg` and Drizzle, and objects use an S3-compatible adapter. Provider APIs remain behind infrastructure adapters and do not enter domain contracts. Logical backups restore into ordinary PostgreSQL, original Media Assets are exportable, and deployment/runbook configuration is versioned so Render, Neon, or R2 can be replaced without redesigning business rules.

## Production acceptance gates

Production is not ready until all applicable gates pass:

- CI, empty-database migration, previous-release upgrade, drift, and rollback-compatibility checks succeed;
- Render health checks and the public/Admin smoke paths succeed;
- Clerk invitation, active local grant, suspension/revocation, and webhook reconciliation fail closed as designed;
- direct upload, bounded derivative generation, signed private access, and urgent media purge are verified;
- the five-minute dispatcher demonstrates idempotent claim, retry, lease recovery, dead-letter alert, and heartbeat behavior;
- an encrypted backup is restored in isolation and the measured RPO/RTO is recorded;
- 30-day privacy-filtered log archival and retention deletion are verified;
- cached content, invalidation, restart cold-cache behavior, and dependency degradation are tested;
- a representative workload remains within 512 MB and the accepted latency/capacity targets;
- the Technical Operator, alert destination, incident path, account ownership, cost alerts, domain, and secret-recovery inventory are documented;
- the ADR-0025 Security Review is complete before any of its trigger capabilities is enabled.
