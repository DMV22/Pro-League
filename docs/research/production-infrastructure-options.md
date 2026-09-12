# Production infrastructure options

Status: research for GitHub issue #26  
Date: 2026-09-12; decision updated 2026-09-12 after authentication and operations grilling  
Scope: production topology only; no infrastructure has been provisioned.

## Executive conclusion

The accepted topology is **Render Starter web + one Render Cron + Neon Launch in Frankfurt + Cloudflare R2 EU + Clerk Hobby + Resend Free**. It has an estimated USD 13/month service minimum and approximately USD 23/month planning cost before domain, taxes, exchange rate, and overages. It is the lowest-cost managed combination found that keeps the single Next.js Node deployment, seven-day managed PostgreSQL restore window, S3-compatible EU objects, invite-only authentication, and an executable scheduled-work path. [Render pricing](https://render.com/pricing), [Render Cron pricing](https://render.com/docs/cronjobs), [Neon pricing](https://neon.com/pricing), [Clerk pricing](https://clerk.com/pricing), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Resend pricing](https://resend.com/pricing?product=marketing)

The initial research treated mandatory Admin MFA as fixed and therefore rejected Clerk Hobby. The subsequent decision explicitly removed mandatory MFA from the single-Admin MVP and deferred stronger authentication to a Security Review before real private documents, a second Admin, or federation Production adoption. Under that revised security boundary, Clerk Hobby is an intentional accepted risk rather than an unmet requirement. WorkOS AuthKit remains the leading no-cost fallback if that review restores an MFA requirement.

The selected entry plans do not contractually guarantee the Portal's 99.5% SLO, 15-minute RPO, or four-hour RTO. Neon supplies seven-day restore/time travel, while encrypted direct-connection `pg_dump` exports to R2 supply 14 daily and six monthly copies. Monitoring, restore drills, bounded image processing, 30-day privacy-filtered log archives, and failure-mode testing remain launch gates rather than assumed provider features.

## Requirements and evaluation rules

The comparison tests each topology against these accepted constraints:

| Requirement | Pass condition used in this report |
|---|---|
| Monthly budget | Target USD 10–20; explicit approval required above USD 25. Domain and transactional email are tracked separately, but Clerk is part of the platform cost. |
| Availability | Internal service SLO of 99.5%. A vendor SLA is recorded separately; absence of an SLA does not automatically prevent an internal SLO, but increases delivery risk. |
| Recovery | RPO at most 15 minutes and RTO at most 4 hours, demonstrated by restore drills rather than inferred from marketing. |
| Backup retention | 7-day PITR plus 14 daily and 6 monthly recoverable copies. |
| Data location | Application, database, and stored objects can be colocated in Europe. Log/monitor data outside Europe is a separate decision. |
| Isolation | Production secrets/data are isolated from preview or staging. Preview databases must not silently share production writes. |
| Portability | Standard Node.js, PostgreSQL, `pg`, Drizzle migrations, and S3-compatible objects are preferred. |
| Workloads | One Next.js 16 modular monolith with Cache Components; low traffic; transactional outbox processing; scheduled jobs; no live match-event stream. |
| Operations | Release-time migrations, monitoring, urgent application-cache purge, and urgent media purge must have an explicit runbook. |
| Authentication | Clerk Hobby invite-only is accepted without mandatory MFA for the initial single-Admin boundary; stronger authentication is reconsidered at the ADR-0025 Security Review triggers. |

Pricing is list pricing from official vendor pages as of the report date. Taxes, exchange rates, domains, email overages, database egress, and unexpected usage are excluded unless stated. “Free at low traffic” is a forecast, not a vendor guarantee.

## Summary matrix

| Topology | Estimated monthly floor | Budget | 7-day PITR | 14 daily + 6 monthly | Europe | Operational load | Main blocker |
|---|---:|---|---|---|---|---|---|
| Vercel Pro + Neon Launch + R2 EU + Clerk Pro | USD 45; about USD 55 typical | Fail, approval required | Included by Neon Launch | Additional scheduled exports/snapshots required | Yes | Low–medium | Cost; snapshot schedule is still documented as Beta |
| Vercel Pro + Neon Launch + Vercel Blob + Clerk Pro | USD 45 floor; Blob likely inside Vercel credit at low use | Fail, approval required | Included by Neon Launch | Additional scheduled exports/snapshots required | Yes | Low | Private Blob is Beta; urgent deletion has cache/browser caveats |
| Render Pro workspace + Starter web + paid PG + cron + R2 + Clerk Pro | USD 59 minimum | Fail, approval required | Included only with Pro workspace | Additional exports required | Yes | Low–medium | Cost; native logs only 14 days; media purge is weaker |
| Render Starter web + cron + Neon Launch + R2 + Clerk Hobby | USD 13 minimum; about USD 23 typical | **Selected**; floor fits and typical stays below approval boundary | Included by Neon Launch | Scheduled encrypted exports required | Yes, over public TLS | Medium | RPO/RTO, 30-day logs, and 512 MB fit require acceptance evidence |
| Hetzner CX23 + self-managed stack + R2 EU + Clerk Pro | USD 26.49 before VAT/IPv4 | Fail by at least USD 1.49; approval required | Must be engineered and operated | Must be engineered and operated | Yes | High | Recovery and security are operator responsibilities |

No row intrinsically guarantees the application’s 99.5% SLO, 15-minute RPO, or 4-hour RTO. Those are end-to-end properties requiring alerts, runbooks, tested restores, and application-level availability measurement.

## Option A — Vercel Pro, Neon Launch, Cloudflare R2 EU

### Cohesive topology

```text
Browser
  -> Vercel CDN / Next.js 16 application (European function region)
       -> Clerk Pro (invite-only Admin + MFA)
       -> Neon PostgreSQL Launch (Frankfurt; pg/Drizzle)
       -> Cloudflare R2 EU (private originals, public derivatives)
       -> Resend (transactional email)
       -> protected Cron endpoint -> transactional-outbox dispatcher
  -> external uptime check / heartbeat
```

Vercel supports European function regions including Frankfurt and Paris; the project must explicitly choose one because the documented default is Washington, D.C. Enterprise-only region failover must not be assumed on Pro. [Vercel function regions](https://vercel.com/docs/functions/configuring-functions/region)

Neon offers Frankfurt and supports normal PostgreSQL connections. Its pooled connection uses PgBouncer transaction pooling; migration commands, `pg_dump`, and any operation that needs session semantics should use the direct/unpooled URL. [Neon regions](https://neon.com/docs/introduction/status), [Neon connection pooling](https://neon.com/docs/connect/connection-pooling), [Neon-to-Neon migration and direct connections](https://neon.com/docs/import/migrate-from-neon)

R2 is S3-compatible. Its EU jurisdiction restricts object storage and processing to the EU; signed URLs support private downloads, and public buckets can use a custom domain with Cloudflare Cache. [R2 data location](https://developers.cloudflare.com/r2/reference/data-location/), [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)

### Included capabilities

- Vercel Pro is USD 20/month and includes one deploying seat plus USD 20/month of usage credit. It supplies production and preview deployments, with custom environments available on Pro. [Vercel Pro](https://vercel.com/docs/plans/pro-plan), [Vercel environments](https://vercel.com/docs/deployments/environments)
- Vercel Cron on Pro supports schedules as frequent as once per minute. A `CRON_SECRET` can authenticate the request. The cron invocation should claim a small outbox batch atomically, send with idempotency keys, and retry safely; Cron itself is not a queue. [Cron pricing and limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [securing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- Next.js can run all features, including Cache Components, in a single Node.js `next start` process. This keeps the application portable away from Vercel. Multiple self-hosted instances would need a shared cache and tag-invalidation coordination, which is not required for the initial Vercel topology. [Next.js deployment](https://nextjs.org/docs/app/guides/deploying-to-platforms), [self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Cache Components](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
- Vercel provides a cache CLI capable of purging CDN/data cache and invalidating tags. Application mutations should still use `updateTag`/`revalidateTag` as the normal path; the CLI is the urgent operational escape hatch. [Vercel cache CLI](https://vercel.com/docs/cli/cache), [Vercel CDN cache](https://vercel.com/docs/caching/cdn-cache)
- Neon Launch includes 7-day time travel/restore. Neon documents paid-plan scheduled daily, weekly, and monthly snapshots with flexible retention, but labels scheduled backups Beta. [Neon pricing](https://neon.com/pricing), [scheduled backups](https://neon.com/docs/changelog/2025-10-31)
- R2’s low-traffic free tier includes 10 GB-month storage, 1 million Class A operations, 10 million Class B operations, and free Internet egress. [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- Cloudflare supports API cache purge by URL on all plans. This is the clearest urgent-media purge mechanism among the evaluated choices. [Cloudflare purge API](https://developers.cloudflare.com/api/resources/cache/methods/purge/), [Instant Purge](https://developers.cloudflare.com/cache/how-to/purge-cache/)

### Required additions and assumptions

- The 7-day Neon PITR covers the short recovery window, but the accepted 14 daily + 6 monthly policy should not depend solely on a Beta snapshot scheduler. Run a scheduled direct `pg_dump` to an encrypted, versioned EU R2 backup bucket, retain 14 daily and 6 monthly objects, and perform quarterly restore drills. The exact scheduler can be GitHub Actions or the application cron; credentials must be scoped to backup only. This is an architecture recommendation, not an included Neon guarantee.
- A 15-minute RPO requires confidence that Neon’s restore point is sufficiently recent **and** that independent WAL/provider operations meet that objective. Neon’s public Launch material states a 7-day restore window but does not state a contractual 15-minute RPO. The project must verify restore-point granularity during a drill before declaring compliance.
- A 4-hour RTO is plausible for this small topology, but no cited Pro/Launch SLA promises it. The runbook must cover creating a replacement Neon branch/project, restoring the latest dump when PITR is unavailable, switching secrets, redeploying, and verifying Admin and public read paths.
- Vercel Pro retains runtime logs for only one day. A 30-day application-log requirement needs a drain/archive or a paid observability product. Vercel Drains are available on Pro and are billed by volume, but the destination cost and EU residency remain separate. [Vercel runtime logs](https://vercel.com/docs/logs/runtime), [Vercel Drains](https://vercel.com/docs/drains)
- Better Stack Free is credible for low-frequency availability checks and cron heartbeats, but its free log retention is only three days. Axiom Personal advertises 30-day free retention, but its documented deployment region is the United States. Therefore neither is a perfect no-cost, EU-resident, 30-day searchable-log solution. [Better Stack pricing](https://betterstack.com/pricing), [Better Stack check frequency](https://betterstack.com/docs/uptime/check-frequency/), [Axiom FAQ](https://axiom.co/docs/get-help/faq), [Axiom limits](https://axiom.co/docs/reference/limits)
- The initial inexpensive compromise is Better Stack for uptime/heartbeat plus privacy-filtered log exports to EU R2 for 30 days. Those archives are recoverable but not equivalent to an indexed log explorer. If searchable 30-day logs are mandatory, approve a paid logging product.

### Cost and SLO verdict

The floor is USD 45/month: Vercel 20 + Neon 5 minimum + Clerk 20 annually billed. Neon’s published typical Launch spend is USD 15, producing a more realistic USD 55 planning estimate. R2 and Resend can remain free only while usage stays inside their allowances. Resend Free provides 3,000 emails/month with a 100/day limit. [Neon pricing](https://neon.com/pricing), [Resend pricing](https://resend.com/pricing?product=marketing)

Neither Vercel Pro nor Neon Launch provides the vendor-backed SLA needed to treat 99.5% as guaranteed. Neon’s SLA applies to its higher plans. The project can nevertheless operate toward a 99.5% internal SLO with synthetic monitoring, error-budget reporting, and recovery drills; this is an operational target, not a contractual composite SLA. [Neon SLA](https://neon.com/sla)

**Verdict:** recommended if the monthly platform budget is raised to approximately USD 55 and the team accepts that the SLO/RPO/RTO are internally managed rather than vendor-guaranteed.

## Option B — Vercel Pro, Neon Launch, Vercel Blob

This is identical to Option A except that Vercel Blob replaces R2.

Vercel Blob costs USD 0.023/GB-month for storage; its public and private storage are priced the same, and low usage may be absorbed by the Vercel Pro usage credit. A Blob store’s region is selected at creation and cannot later be changed. [Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing), [Blob regions](https://vercel.com/docs/vercel-blob)

The drawbacks matter for this project:

- Private Blob is documented as Beta. [Private Blob](https://vercel.com/docs/vercel-blob/private-storage)
- Blob deletion or overwrite may take up to 60 seconds to propagate through the cache, and a user’s browser cache can retain a previously fetched object. Immutable versioned keys are recommended. [Vercel Blob](https://vercel.com/docs/vercel-blob), [Blob SDK guidance](https://vercel.com/docs/vercel-blob/using-blob-sdk)
- The API and URL model are less portable than an S3-compatible repository abstraction.

**Verdict:** simplest Vercel integration, but not recommended as the sole media store while private storage is Beta and an urgent purge must be dependable. R2 with EU jurisdiction and API URL purge is a better fit.

## Option C — cohesive Render hosting

### Topology

```text
Browser
  -> Render paid Node web service (Next.js, Frankfurt)
       -> Render PostgreSQL (private same-region network)
       -> Clerk Pro
       -> R2 EU
       -> Resend
  -> Render Cron Job -> protected internal dispatcher endpoint or DB outbox claim
```

Render documents deploying a full Next.js application as a Node web service. Frankfurt is available for services and databases, and same-region services communicate over Render’s private network. [Render Next.js](https://render.com/docs/deploy-nextjs-app), [Render regions](https://render.com/docs/regions)

### Included capabilities

- The smallest paid web service is USD 7/month, the smallest paid PostgreSQL instance is USD 6/month, and a cron job has a USD 1/month minimum. [Render pricing](https://render.com/pricing), [Render Cron Jobs](https://render.com/docs/cronjobs)
- Render’s pre-deploy command is appropriate for `drizzle-kit migrate`: it runs before the new release, and a failure prevents the new deploy while the old version continues serving. [Render deploys](https://render.com/docs/deploys)
- Projects/environments isolate resources and environment variables. Hobby workspaces permit two environments per project; preview environments and stronger controls require paid workspace features, and cloned preview resources incur normal resource charges. [Render projects](https://render.com/docs/projects), [Render preview environments](https://render.com/docs/preview-environments)
- Paid web services have health checks and zero-downtime deploy behavior. A single instance can still restart or move for several minutes; Render recommends multiple instances for stronger availability. [Render health checks](https://render.com/docs/health-checks), [Render deploys](https://render.com/docs/deploys), [Render uptime guidance](https://render.com/docs/uptime-best-practices)

### Non-compliance and cost

Render PostgreSQL provides only three days of PITR in a Hobby workspace. Seven-day PITR requires the USD 25/month Pro workspace. Logical backup exports are retained for seven days, not the required 14 daily + 6 monthly. Render also notes that PITR cannot target the most recent ten minutes, which does not by itself disprove a 15-minute RPO but leaves almost no margin. [Render PostgreSQL backups](https://render.com/docs/postgresql-backups)

The compliant starting bill is therefore at least USD 59/month: Pro workspace 25 + web 7 + PostgreSQL 6 + cron 1 + Clerk Pro 20. This excludes storage, domain, taxes, and expanded monitoring. The cheaper Hobby version would start at USD 34 but fails the 7-day PITR requirement.

Render Pro retains platform logs for 14 days; 30 days requires a higher workspace tier or an external stream/archive. [Render logging](https://render.com/docs/logging), [Render log streams](https://render.com/docs/log-streams)

Render’s edge-cache documentation describes purge on a new deploy or manual purge. It does not document a granular public purge API equivalent to Cloudflare’s. Store media in R2 and use Cloudflare URL purge; avoid depending on Render edge caching for content requiring immediate operational invalidation. [Render web-service caching](https://render.com/docs/web-service-caching)

Seven-day PITR still does not satisfy 14 daily + 6 monthly copies. Render publishes an official `pg_dump`-to-S3 cron pattern, which can be adapted to R2 and the accepted retention rules. [Render PostgreSQL-to-S3 backups](https://render.com/docs/backup-postgresql-to-s3)

Render’s public pricing lists its SLA under Enterprise, so the evaluated Pro/Starter combination should not be treated as contractually guaranteeing the internal 99.5% SLO. PostgreSQL high availability also requires larger instances and bills the standby, putting it far outside the target. [Render pricing](https://render.com/pricing), [Render PostgreSQL HA](https://render.com/docs/postgresql-high-availability)

**Verdict:** coherent and migration-friendly, but materially more expensive than Vercel + Neon and still needs external long-retention backups, 30-day logs, and R2 for reliable media purge. Not recommended for the low-traffic MVP.

## Option C2 — Render Starter with external Neon and Clerk Hobby

### Cost and topology

```text
Browser
  -> Render Starter Node web service, Frankfurt (Next.js 16)
       -> Neon Launch PostgreSQL, Frankfurt, over public TLS
       -> Clerk Hobby (invite-only, no MFA)
       -> Cloudflare R2 EU
       -> Resend Free
  -> Render Cron -> Neon transactional outbox / backup job
```

The monthly floor is **USD 13**: Render Starter web USD 7 + Render Cron USD 1 minimum + Neon Launch USD 5 paid-plan minimum. Clerk Hobby, R2, and Resend can remain USD 0 within their free allowances. Neon describes USD 15 as a typical Launch bill, making **about USD 23/month** the better planning number before tax, domain, logging, and overages. [Render pricing](https://render.com/pricing), [Render Cron pricing](https://render.com/docs/cronjobs), [Neon pricing](https://neon.com/pricing), [Neon paid-plan minimum](https://neon.com/docs/changelog/2025-11-07), [Clerk pricing](https://clerk.com/pricing), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Resend pricing](https://resend.com/pricing?product=marketing)

The floor fits the USD 10–20 target and the typical estimate remains below the USD 25 approval boundary. It is materially cheaper than using Render PostgreSQL with a Pro workspace solely to obtain seven-day PITR.

### Database connectivity and releases

Render can connect to Neon as any external PostgreSQL client. Use the Neon **pooled** URL with `sslmode=require&channel_binding=require` for the running web process and cron/outbox claims; use the **direct** URL for `drizzle-kit migrate` and `pg_dump`, where session semantics are preferable. Neon documents PgBouncer-based pooled URLs and TLS/channel binding, and explicitly lists `node-postgres` support. [Neon pooling](https://neon.com/docs/connect/connection-pooling), [Neon secure connection guidance](https://neon.com/docs/connect/connection-errors)

This connection crosses the public network; it is encrypted but is not Render private networking. Render publishes shared outbound CIDR ranges that can be allowlisted by external systems, but current Neon documentation places IP Allow and Private Networking on higher tiers rather than Launch. Therefore Launch should be treated as publicly reachable behind TLS, high-entropy credentials, least-privilege PostgreSQL roles, and regular rotation—not as a private database link. [Render outbound addresses](https://render.com/docs/outbound-ip-addresses), [Neon security overview](https://neon.com/docs/security/security-overview)

Run the Drizzle migration through Render’s paid-service pre-deploy command using a dedicated direct migration URL/role. Render runs that command on a separate instance before activation; failure aborts the deploy while the previous successful version keeps serving. Use expand/contract migrations because application rollback does not roll back the database. [Render deploy sequence](https://render.com/docs/deploys)

### Next.js Cache Components and compute fit

A single `next start` process supports Server Components, PPR, Cache Components, Server Actions, Proxy, and `after()`. No shared cache is needed while exactly one Render instance is active. The default Cache Components cache is in memory and is lost on restart; that affects warm-cache performance, not canonical data correctness, provided PostgreSQL remains the source of truth and mutations invalidate tags. Scaling to multiple instances would require a shared cache/tag coordination design. [Next.js platform requirements](https://nextjs.org/docs/app/guides/deploying-to-platforms), [Cache Components handlers](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers)

Render Starter provides **0.5 CPU and 512 MB RAM**. That is plausible for this low-traffic monolith but is an acceptance-test assumption, not a capacity guarantee. Next.js documents that self-hosted `next/image` optimization runs at request time through `sharp` and may need configuration to prevent excessive memory use on glibc Linux. Do not synchronously resize large federation uploads on the web request path: validate dimensions/size, store originals in R2, create bounded derivatives asynchronously or before upload, prefer WebP over AVIF for lower first-encode cost, and load-test peak RSS before launch. Upgrade to Render’s 1 CPU/2 GB service at USD 25 if ordinary traffic or image work approaches the 512 MB limit. [Render compute plans](https://render.com/docs/compute-plans), [Next.js self-hosted image optimization](https://nextjs.org/docs/app/guides/self-hosting), [Next.js image format tradeoffs](https://nextjs.org/docs/pages/api-reference/components/image)

### Cron, backups, logs, and failure boundaries

- **Outbox:** a Render Cron job can run every few minutes, connect directly to Neon with the pooled least-privilege runtime role, atomically claim a bounded outbox batch, deliver with idempotency keys, record outcomes, and exit. Calling a protected web endpoint is possible but introduces an unnecessary dependency on web-service availability. Render cron schedules are UTC and each run is a separate billed job. [Render Cron Jobs](https://render.com/docs/cronjobs)
- **Recovery:** Neon Launch includes a seven-day restore/time-travel window, removing the three-day Render Hobby PostgreSQL gap. Keep the independent encrypted direct-connection `pg_dump` exports to R2 for 14 daily + 6 monthly retention because Neon scheduled snapshots are documented as Beta. The 15-minute RPO and four-hour RTO are still unproven until restore drills demonstrate them. [Neon pricing](https://neon.com/pricing), [Neon scheduled backups](https://neon.com/docs/changelog/2025-10-31)
- **Logs:** a Render Hobby workspace retains logs for seven days, so the accepted 30-day application-log requirement still needs an external drain/archive. [Render logging](https://render.com/docs/logging), [Render log streams](https://render.com/docs/log-streams)
- **Network and egress:** every database result and dump travels from Neon to Render/R2 over a cross-provider link. Neon Launch includes 100 GB/month of public network transfer and charges USD 0.10/GB above it; unbounded queries, large result sets, and frequent dumps can erase the price advantage. [Neon network transfer](https://neon.com/docs/introduction/network-transfer)
- **Connection resets:** Render can reset long-lived outbound TCP connections when its routing changes, so the `pg` pool must discard broken clients and retry only safe/idempotent operations. [Render outbound connection resets](https://render.com/docs/outbound-connection-resets)
- **Composite availability:** colocating both products in “Frankfurt” reduces expected latency but does not create a private link or prove same-datacenter placement. The application now depends on Render, Neon, their public network path, Clerk, and R2. Neither the internal 99.5% SLO nor four-hour RTO is guaranteed by combining their entry plans.

### Security verdict

This topology is accepted after revising the initial security boundary. Clerk Hobby supports invite-only access but does not include MFA and uses its provider-managed session policy. PostgreSQL still authorizes every protected request through an Active Admin Access Grant, and sensitive access-management, Break-glass, private-document bulk export, and security-configuration capabilities remain disabled until the ADR-0025 Security Review. [Clerk pricing](https://clerk.com/pricing), [Clerk restricted/invite-only access](https://clerk.com/docs/guides/secure/restricting-access), [Clerk development and production instances](https://clerk.com/docs/guides/development/managing-environments)

WorkOS AuthKit remains the preferred hosted fallback if mandatory TOTP MFA returns. It preserves the same USD 13 minimum / about USD 23 planned hosting total, but changing provider is not justified while one Admin, invite-only access, local authorization, and the review gates bound the accepted MVP risk.

## Option D — low-cost Hetzner VPS with self-managed PostgreSQL

### Topology

```text
Cloudflare DNS/CDN
  -> one Hetzner CX23 in Europe
       -> reverse proxy
       -> Next.js Node process
       -> PostgreSQL
       -> outbox worker / system timer
       -> monitoring/export agents
  -> R2 EU for public/private media and encrypted database archives
  -> Clerk Pro / Resend
```

Hetzner lists the European CX23 at USD 6.49/month from 15 June 2026, excluding VAT and IPv4. Cloud-server backups cost 20% of the server price and retain seven backup slots. A CX23 plus Clerk Pro therefore starts at about USD 26.49/month before VAT/IPv4; native server backups add about USD 1.30. [Hetzner price adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/), [Hetzner cloud billing and backups](https://docs.hetzner.com/cloud/billing/faq/)

Hetzner publishes a 99.9% cloud-server uptime SLA, which is above the project’s 99.5% target at the infrastructure layer. It does not cover application bugs, database corruption, operator error, or recovery time. Hetzner also explicitly places server administration and security responsibility on the customer. [Hetzner cloud SLA](https://docs.hetzner.com/general/company-and-policy/slas-cloud/), [Hetzner responsibility model](https://docs.hetzner.com/general/security-and-identify/technical-and-organizational-measures/)

PostgreSQL can meet point-in-time recovery through continuous WAL archiving plus base backups, but this is a PostgreSQL capability the project must configure, monitor, and test—not an included Hetzner managed-database feature. [PostgreSQL continuous archiving and PITR](https://www.postgresql.org/docs/17/continuous-archiving.html)

To attempt the accepted recovery policy, the operator must:

1. archive WAL continuously to encrypted EU R2 and alert if the latest archived segment becomes older than 15 minutes;
2. create regular base backups, retain enough for a 7-day PITR window, and keep 14 daily plus 6 monthly logical or physical recovery sets;
3. restore quarterly into an isolated environment and record actual RPO/RTO;
4. patch the OS, PostgreSQL, Node.js, reverse proxy, and backup tooling;
5. maintain deploy rollback, secrets rotation, disk-capacity alerts, and off-server observability;
6. use immutable media keys and Cloudflare URL purge for urgent withdrawal.

A single VPS offers no physical redundancy. Native seven-slot snapshots do not satisfy 14 daily + 6 monthly retention, and a persistent isolated staging environment needs another server or an explicitly ephemeral CI/local environment. A 4-hour RTO is possible only after a scripted bare-server restore has repeatedly demonstrated it.

**Verdict:** the only near-threshold option and the most portable, but it still requires approval above USD 25 and carries significantly higher operational and recovery risk. Choose it only if the maintainer explicitly accepts production DBA/SRE duties.

## Lower-cost authentication alternatives

This section reopens only the auth-provider part of the accepted Clerk design. In every option, the external identity is **not** the application authorization source. On each privileged request, the server must validate the provider session and then load an enabled local `Admin` record keyed by the stable provider subject. An invitation or a valid identity token alone never grants federation administration rights.

### Cost matrix

The infrastructure floors below reuse the same assumptions and official prices documented earlier: Render Hobby workspace with a USD 7 paid web service, USD 6 paid PostgreSQL, USD 1 cron minimum, and R2 within its free tier; Vercel Pro USD 20 plus Neon Launch’s USD 5 paid-plan minimum and R2 free; or Hetzner CX23 USD 6.49 before VAT and an optional USD 0.60 IPv4 address. Neon says USD 15 is a typical Launch bill, so the Vercel column should be planned as USD 35 rather than its USD 25 minimum. [Render pricing](https://render.com/pricing), [Render Cron Jobs](https://render.com/docs/cronjobs), [Vercel Pro](https://vercel.com/docs/plans/pro-plan), [Neon pricing](https://neon.com/pricing), [Neon paid-plan minimum](https://neon.com/docs/changelog/2025-11-07), [Hetzner pricing](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)

| Authentication option | Auth floor | A: Render web + PG + cron + R2 | B: Vercel Pro + Neon + R2 | C: Hetzner + R2 | Production verdict |
|---|---:|---:|---:|---:|---|
| WorkOS AuthKit | USD 0 | **USD 14** | **USD 25 minimum / ~USD 35 typical** | **USD 6.49**, or USD 7.09 with IPv4 | Best hosted alternative |
| Descope Free | USD 0 | **USD 14** | **USD 25 minimum / ~USD 35 typical** | **USD 6.49**, or USD 7.09 with IPv4 | Credible, but vendor SLA is only 99% |
| Better Auth self-hosted | USD 0 software fee | **USD 14** | **USD 25 minimum / ~USD 35 typical** | **USD 6.49**, or USD 7.09 with IPv4 | Lowest dependency/cost; highest security ownership |
| Supabase Auth Free | USD 0 | USD 14 | USD 25 minimum / ~USD 35 typical | USD 6.49, or USD 7.09 with IPv4 | Technically possible, not recommended on a pausable Free project |
| Auth0 Essentials | USD 35 | USD 49 | USD 60 minimum / ~USD 70 typical | USD 41.49, or USD 42.09 with IPv4 | Reject: more expensive than Clerk Pro |

These are low-traffic floors, not caps. They exclude domain, taxes, email overages, paid logging, backup storage above R2’s allowance, and any provider usage above its free allowance.

### 1. WorkOS AuthKit — preferred hosted replacement

WorkOS AuthKit is free for up to one million monthly active users, including email/password authentication, TOTP/SMS MFA, and RBAC. A production environment requires billing information, but username/password AuthKit under the free MAU limit incurs no charge when paid enterprise connections are not used. Staging is separate and free. The public pay-as-you-go offering does not include the 99.99% SLA advertised with annual-credit arrangements, so no vendor-backed SLA should be assumed for this zero-cost plan. [WorkOS pricing](https://workos.com/pricing), [WorkOS staging and production environments](https://workos.com/docs/authkit/environments)

It satisfies the required auth flow directly:

- TOTP is a documented MFA grant, and an organization authentication policy can enforce MFA for all users accessing that organization. [WorkOS TOTP authentication](https://workos.com/docs/reference/authkit/authentication), [WorkOS organization authentication policies](https://workos.com/docs/authkit/sso-with-contractors)
- Disabling signup blocks registration through both AuthKit and the API; a valid invitation code temporarily opens registration. This is a native closed-registration flow, not a client-side hiding convention. [WorkOS invitations](https://workos.com/docs/authkit/invitations)
- WorkOS provides a first-party Next.js integration path. [AuthKit quickstart index](https://workos.com/docs/authkit/landing)

For this single-role platform, create one federation organization, enforce MFA on it, and issue organization-specific invitations. Do not rely on application-wide invitation email matching: WorkOS documents that an application-wide invitation can be accepted using a different email address, while organization invitations apply stricter exact-address or same-corporate-domain rules. The local Admin allowlist must still match the authenticated WorkOS user ID and expected verified email before granting access. [WorkOS invitation acceptance rules](https://workos.com/docs/authkit/invitations)

**Tradeoffs:** this is an external availability dependency; free pay-as-you-go has no cited SLA; production requires a payment method; auth configuration and users remain provider-managed. Exportability and an account-recovery runbook must be verified before launch.

### 2. Descope Free — credible hosted fallback

Descope Free Forever is USD 0 for up to 7,500 MAU and ten active tenants, includes all authentication methods, MFA/step-up, RBAC, and a 99% SLA. It also supports an EU project region selected at project creation. The 99% vendor SLA is below the platform’s 99.5% internal SLO, so the composite SLO cannot be presented as vendor-guaranteed. [Descope pricing](https://www.descope.com/pricing), [Descope project settings and regions](https://docs.descope.com/management/project-settings)

Descope provides the required features without a paid tier:

- Authenticator Apps implement TOTP, and authentication flows can use TOTP as a factor. [Descope TOTP settings](https://docs.descope.com/auth-methods/auth-apps/settings), [Descope flow authentication methods](https://docs.descope.com/flows/actions/authentication-methods)
- `Block self-registration sign up` restricts login to previously invited users or SSO users. Invitations can expire, be resent, and be created from the Console or Management SDK. [Descope project settings](https://docs.descope.com/management/project-settings), [Descope invitations](https://docs.descope.com/management/user-management/invite-users)
- The official Next.js SDK supports middleware, server session access, and App Router integration. [Descope Next.js quickstart](https://docs.descope.com/getting-started/nextjs/index), [server-side session access](https://docs.descope.com/getting-started/nextjs/user-and-session-data)

Configure a production-tagged EU project, block self-registration, require the chosen password-plus-TOTP sequence in the login flow, and enforce the local Admin record server-side. Note that refresh-token rotation is documented as Pro+, so the security review must explicitly accept the Free session model or reject this option. [Descope session settings](https://docs.descope.com/management/project-settings)

**Tradeoffs:** lower contractual availability than the SLO, only community support, finite free-project limits, and visual-flow/provider coupling. It is a valid budget option but weaker than WorkOS for this project.

### 3. Better Auth — preferred self-hosted replacement

The Better Auth framework is free and open source; its published prices apply to optional managed infrastructure. It runs inside the Next.js application and stores users, sessions, factors, and recovery data in the project PostgreSQL database. It has a Drizzle PostgreSQL adapter and a working Next.js example that includes two-factor authentication. [Better Auth pricing](https://better-auth.com/pricing), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [Next.js example](https://better-auth.com/docs/examples/next-js)

The built-in 2FA plugin supports TOTP, backup codes, and account lockout after repeated failed verification. Credential-based sign-in is gated when 2FA is enabled; passwordless/social methods are not gated by default and would require custom hooks, so the MVP should expose only the reviewed email/password-plus-TOTP path. [Better Auth 2FA](https://better-auth.com/docs/plugins/2fa)

For a true closed system, disable email/password public signup and any implicit social signup. Provision the first Admin through the CLI/Admin plugin and build a server-only invitation/activation flow. Better Auth’s organization invitation flow assumes the recipient can log in before accepting, so it is not by itself an application-account invitation; the project must own the activation token, email delivery, expiry, single use, email match, password setup, and forced TOTP enrollment. [Better Auth options](https://better-auth.com/docs/reference/options), [Admin plugin and user creation](https://better-auth.com/docs/1.6/plugins/admin), [organization invitations](https://better-auth.com/docs/plugins/organization)

**Tradeoffs:** there is no external auth charge or auth-vendor outage, and identity data follows the existing PostgreSQL backups. Conversely, the project owns password/session security, secret rotation, email enumeration defenses, rate limiting, dependency patching, factor recovery, incident response, and migration compatibility. On Render and Neon, auth recovery inherits the database topology’s backup properties; on Hetzner it is unavailable unless the self-managed WAL/archive plan works. There is no separate auth-provider SLA.

### Not selected

**Supabase Auth Free:** TOTP MFA is free and enabled on all projects; Supabase documents enforcing `aal2` in server-side/API authorization, supports disabling new signups, provides an Admin invite-by-email API, and has an official Next.js SSR path. [Supabase TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp), [MFA enforcement](https://supabase.com/docs/guides/auth/auth-mfa), [signup control](https://supabase.com/docs/guides/auth/general-configuration), [invite API](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [Next.js auth](https://supabase.com/docs/guides/auth/quickstarts/nextjs)

However, Supabase labels Free for passion projects/simple sites, labels Pro from USD 25 for production applications, and pauses Free projects after one week of inactivity. A low-use invite-only Admin system can therefore become unavailable precisely because no Admin signed in recently. Using Supabase Pro only for auth would add USD 25 and erase the saving, while combining it with a different PostgreSQL provider adds a second database/control plane. It is not recommended for this topology. [Supabase pricing](https://supabase.com/pricing)

**Auth0:** Auth0 has a mature Next.js 16 SDK, can disable database signups, and documents invitation workflows and authenticator-app OTP. But its Free plan does not list Pro MFA; Essentials, which includes Pro MFA, starts at USD 35/month for 500 MAU. That is more expensive than Clerk Pro before hosting and therefore is not a lower-cost alternative. [Auth0 pricing](https://auth0.com/pricing), [Auth0 Next.js quickstart](https://auth0.com/docs/quickstart/webapp/nextjs), [disable signup](https://auth0.com/docs/libraries/lock/lock-configuration), [invitation workflow](https://auth0.com/docs/customize/email/send-email-invitations-for-application-signup), [OTP MFA](https://auth0.com/docs/secure/multi-factor-authentication/multi-factor-authentication-factors/configure-otp-notifications-for-mfa)

### Recovery effect by hosting topology

Changing authentication does not change these database recovery facts:

- **A — Render USD 14 floor:** fits the USD 10–20 target with WorkOS, Descope, or Better Auth, but a paid Render database in a Hobby workspace has only three days of PITR, not seven. Scheduled `pg_dump` exports to R2 can implement 14 daily + 6 monthly copies but cannot create continuous seven-day PITR. Render also excludes the newest ten minutes from PITR targets. RPO 15 minutes and RTO 4 hours remain acceptance-test outcomes, not contractual guarantees. [Render PostgreSQL backups](https://render.com/docs/postgresql-backups), [Render S3 backup pattern](https://render.com/docs/backup-postgresql-to-s3)
- **B — Vercel/Neon USD 25 minimum, ~USD 35 typical:** misses the USD 10–20 target but the minimum no longer exceeds the USD 25 approval boundary. Neon Launch includes seven-day restore/time travel; independent R2 exports are still required for 14 daily + 6 monthly because scheduled snapshots are documented as Beta. A 15-minute RPO and four-hour RTO still require drills. [Neon pricing](https://neon.com/pricing), [Neon scheduled backups](https://neon.com/docs/changelog/2025-10-31)
- **C — Hetzner USD 6.49/7.09 floor:** fits the target, but no managed database recovery is included. Seven-day PITR, RPO 15 minutes, 14 daily + 6 monthly retention, and RTO 4 hours all remain **unmet until** WAL archiving, base backups, monitoring, scripted rebuild, and timed restore drills are operating successfully. Hetzner’s optional server backup keeps only seven slots and is insufficient by itself. [PostgreSQL PITR](https://www.postgresql.org/docs/17/continuous-archiving.html), [Hetzner backup slots](https://docs.hetzner.com/cloud/billing/faq/)

### Lower-cost recommendation

The accepted budget-managed option is Render Starter + Render Cron + Neon Launch + R2 + Clerk Hobby at USD 13 minimum and approximately USD 23 planned. Neon supplies the seven-day restore window that the inexpensive cohesive Render database option lacks; long-retention exports, 30-day logs, load testing, and recovery drills remain required.

If the ADR-0025 Security Review restores mandatory MFA, WorkOS AuthKit is the preferred hosted replacement at the researched price point. Vercel Pro + Neon remains the lower-operations fallback when stronger native Next.js integration justifies approximately USD 35/month with free authentication. Hetzner remains the lowest-cash fallback but transfers database, security, recovery, and host maintenance to the Technical Operator.

## Cross-cutting implementation decisions

### Environment isolation

- Production: Render Starter and Cron, a dedicated Neon Launch project, Clerk Hobby Production, separate R2 buckets and keys, and Production Resend credentials.
- Shared Staging: Render Free, a dedicated Neon Free project, a separate Clerk Development application, separate R2 keys, and synthetic data. Scheduled work is triggered manually rather than provisioning paid Cron.
- Local: local PostgreSQL by default or a dedicated development Neon project, Clerk Development, and dedicated development objects.
- Never copy real user data into previews without an explicit anonymisation process.

Neon Launch permits protected branches and a limited number of branches; its exact current allowance must be checked when provisioning because branch/compute usage affects cost. [Neon accidental-deletion recovery FAQ](https://neon.com/faqs/databases-recover-accidental-data-deletion)

### Release and migrations

1. CI runs type checks, tests, Drizzle schema validation, and a migration rehearsal against an ephemeral database.
2. Backward-compatible `drizzle-kit` migrations run once through a direct PostgreSQL connection before traffic reaches code that requires them.
3. Deploy the application; verify health, public pages, Clerk Admin access, object reads, and an outbox heartbeat.
4. Destructive schema cleanup occurs only in a later release after the old code is gone and a fresh recovery point exists.

On Render this maps directly to a pre-deploy command. On Vercel, run migrations as a single protected CI/release job rather than from every serverless instance.

### Background work

For the initial low volume, keep the transactional outbox in PostgreSQL. A scheduled dispatcher claims rows with a short lease, uses provider idempotency keys, records attempt/result metadata, and leaves failed messages retryable. This avoids a paid queue while maintaining transactional consistency. It is an application design assumption; neither Vercel Cron nor Render Cron supplies exactly-once delivery.

If execution regularly exceeds function limits or needs continuous consumption, move only the dispatcher to a long-running worker. Vercel’s function limits and Fluid Compute pricing must be re-evaluated at that point; Render provides a dedicated background-worker service but it adds another paid instance. [Vercel function limits](https://vercel.com/docs/functions/limitations), [Vercel function pricing](https://vercel.com/docs/functions/usage-and-pricing), [Render background workers](https://render.com/docs/background-workers)

### Cache and urgent purge runbook

- Normal editorial publish/correction: commit the database transaction, then call the appropriate Next.js cache-tag invalidation.
- Emergency application purge on the single Render instance: suppress the database projection, invalidate the typed Next.js cache tags, and verify from an uncached request; a redeploy clears the disposable in-memory cache if the normal adapter cannot confirm eviction.
- Media: upload under an immutable versioned key. Withdraw by removing database references and authorization immediately, purge the public Cloudflare URL, and then delete the object. A private signed URL remains usable until expiry, so use short lifetimes for sensitive assets.
- R2 lifecycle rules are retention tools, not urgent purge tools; expiration can take roughly 24 hours. [R2 lifecycle timing](https://developers.cloudflare.com/r2/buckets/object-lifecycles/), [R2 consistency and cached objects](https://developers.cloudflare.com/r2/reference/consistency/)

### Monitoring and recovery acceptance

Before production launch, the platform is not considered compliant until it has:

- public homepage and Admin-login synthetic checks;
- a database connectivity/read check that does not expose data;
- cron/outbox heartbeat and dead-letter alert;
- backup-age, restore, disk/storage, error-rate, and latency alerts;
- privacy-filtered application logs with the accepted 30-day retention;
- a written incident owner and contact path;
- a timed restore drill proving an actual recovery point no older than 15 minutes and service recovery within 4 hours.

## Accepted recommendation

Adopt **Render Starter + one Render Cron + Neon Launch Frankfurt + Cloudflare R2 EU + Clerk Hobby + Resend Free** at USD 13 minimum / approximately USD 23 planned. Keep WorkOS AuthKit as the stronger-authentication fallback, Vercel Pro + Neon as the lower-operations fallback, and Hetzner only as a deliberate self-management choice.

The selected hybrid can remain inside USD 10–20 only near Neon's minimum consumption; its published typical database spend takes the plan to about USD 23. Cost warnings start at USD 20 and recurring spend above USD 25 requires explicit approval. Local Development and shared free-tier Staging require no recurring service payment when Cron runs manually and usage remains inside provider allowances.

The 99.5% target is an **internal SLO**, not a vendor-backed SLA on the selected entry plans. Neon scheduled backups remain Beta, and the accepted RPO/RTO are unproven until the first restore drill. The complete implementation boundary and acceptance gates are recorded in [the production infrastructure blueprint](../architecture/production-infrastructure.md) and ADR-0026.
