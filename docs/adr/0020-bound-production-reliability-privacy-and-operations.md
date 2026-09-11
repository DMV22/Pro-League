---
status: accepted
---

# Bound production reliability, privacy, and operations

ProLeague will operate as a low-traffic, cost-first federation portal without treating low expected usage as permission to weaken recovery, privacy, security, accessibility, or audit guarantees. The production architecture targets USD 10–20 in recurring monthly infrastructure cost; exceeding USD 25 requires an explicit decision. Domain and transactional email costs are tracked separately, and capacity grows from observed demand rather than speculative forecasts.

## Consequences

The capacity baseline is 100 concurrent public requests and 10 Admin sessions, with Published public reads primarily served through caching. This is a modest burst-test target rather than expected sustained traffic. The Public Portal targets 99.5% monthly availability excluding announced maintenance. During partial failure, cached Published information is prioritized while unsafe mutations, publication, and unaudited changes fail closed.

At the 75th percentile, public pages target LCP at or below 2.5 seconds, INP at or below 200 milliseconds, CLS at or below 0.1, and cached server responses at or below 500 milliseconds. Admin mutations target two seconds excluding uploads. The Portal supports the current two major versions of Chrome, Edge, Firefox, and Safari, responsive mobile access, and server-rendered critical public information.

The disaster-recovery objectives are an RPO of 15 minutes and RTO of four hours. Recovery covers PostgreSQL, original Media Assets and reproducible variants, deployment configuration, a secret-recovery inventory and procedure, and Clerk and webhook runbooks. PostgreSQL has seven days of point-in-time recovery, 14 days of daily backups, and six months of monthly backups. The Technical Operator performs an isolated restore test quarterly and before high-risk data migrations, recording integrity and recovery duration.

The Technical Operator owns deployment, monitoring, incident response, backup, and technical restoration but is not a separate Admin-interface business role. An Admin validates restored results, standings, applications, and publications before mutations and scheduled publication are unblocked. One person may initially carry both responsibilities, but the responsibilities remain distinct.

Production services are co-located in a European region close to Ukraine and use encrypted connections and provider encryption at rest. Development, Preview/Staging, and Production have separate databases, object storage, Clerk environments, secrets, and webhooks. Production Player data is never copied to non-production environments; test data is synthetic or anonymized. Private documents use authenticated, short-lived access and Player personal data is excluded from logs and analytics.

Published competition history and Audit History form the permanent federation archive. Private Player registration data is reviewed after the Player's last participation plus five years; supporting application and eligibility documents are retained for three years after the Season; Privacy Requests and decisions for five years; abandoned Drafts and orphaned Media Assets for 30 days. A reasoned, audited Legal Hold suspends deletion for a protest, investigation, or legal obligation.

Application logs are retained for 30 days, Security Events for 90 days, and aggregated non-personal operational metrics for 12 months. Privacy deletion removes data from the live system and cache. Immutable backups expire under their normal schedule; a deletion ledger is reapplied before service is reopened after restoration.

The Ukrainian-only MVP uses Unicode, DD.MM.YYYY dates, 24-hour time, Europe/Kyiv display, and UTC persistence, while user-facing strings remain externalizable. Both public and Admin interfaces target WCAG 2.2 AA. Automated checks run during development, and critical flows receive manual keyboard and screen-reader verification before release.

A Player Public Profile contains only the permitted sporting identity and never exposes exact birth date, federation identifier, contact details, address, or supporting documents. A Player under 18 requires a recorded lawful basis or representative consent for a photo and full profile; the record includes grantor, date, scope, expiry when applicable, and revocation history. Otherwise only the minimum Official sporting identification is published.

An external Privacy Request is handled privately and audited. It is acknowledged within five business days and targeted for resolution within 30 calendar days through Received, In Review, Fulfilled, Partially Fulfilled, or Rejected. A reasoned outcome may correct data, restrict a profile, remove or replace a photo, delete unnecessary private data, or preserve required Official sporting history.

The MVP uses no advertising, tracking pixels, or behavioural profiling. Public analytics is minimal and cookieless; Clerk cookies are limited to Admin authentication. Monitoring covers public and Admin health, errors, latency and web-vitals signals, database and storage capacity, backups, Clerk webhooks, scheduled publication, certificates, domain expiry, and infrastructure cost.

Critical alerts go immediately by email to the Technical Operator, with an optional channel such as Telegram; warnings may be summarized daily. SEV-1 covers data exposure, corruption, or total outage and targets response within one hour. SEV-2 covers Admin outage or public degradation and targets four hours. SEV-3 targets the next business day. SEV-1 and SEV-2 produce a private Incident Record and postmortem; an Admin owns federation communication and any required public notice.

Published cached pages show their last-updated time and a warning when currentness cannot be confirmed. Visitor-impacting planned maintenance is announced approximately 48 hours beforehand when practical. Security fixes target 72 hours for critical risk, 14 days for high risk, and monthly review otherwise.

Deployments use backward-compatible migrations, health checks, a tested rollback path, and backups before high-risk data changes; destructive schema changes are not combined with dependent code removal in one release. CDN caching, rate limits, bounded uploads, bounded database queries, and verified Clerk webhook signatures protect the small production footprint.

PostgreSQL data, original Media Assets, and required configuration remain exportable through a documented procedure so the federation can change providers without relying on a closed data format.
