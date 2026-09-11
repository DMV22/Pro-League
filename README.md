# ProLeague

ProLeague is an official information portal for football competitions administered or covered by a local federation. It is being developed as a production-oriented replacement for the repository's original football manager simulator prototype.

The Portal will provide public access to federation-approved news, competitions, seasons, teams, season rosters, matches, results, and standings. Visitors do not need an account. At launch, one invite-only Admin role manages Official information.

## Target architecture

The MVP is designed as a single Next.js App Router modular monolith and a single application deployment:

```text
Public Portal and Admin interface
                |
                v
        Next.js application
        - Server Components
        - Server Actions
        - Route Handlers
        - application services
        - domain modules
                |
        +-------+-------+
        |               |
        v               v
   PostgreSQL      Object storage

Admin identity and sessions: Clerk invite-only
```

- **PostgreSQL** is the authoritative store for public and administrative data.
- **Clerk** authenticates invited Admin identities; the application still verifies that an identity maps to an active Admin record.
- Clerk Organizations and Clerk role metadata are not authorization sources in the MVP; PostgreSQL owns the Admin access state.
- **Object storage** holds uploaded media while PostgreSQL holds its metadata and associations.
- **Server Components** read through server-only application services and repositories.
- **Server Actions** execute mutations initiated by the Admin interface.
- **Route Handlers** expose only genuine HTTP boundaries such as Clerk webhooks or a future public API.
- **Redux Toolkit**, if retained, manages complex client-side UI state only. It is not a source of Official information.

Business rules belong to framework-independent domain and application modules rather than React components, Server Actions, or Route Handlers. This keeps a future extraction to a separate API possible without paying that operational cost during the MVP.

## MVP scope

- Multiple Competitions and Seasons whose formats may contain one or more ordered stages.
- Independent Season sporting lifecycle, public visibility, and Team Entry, Roster Registration, and Roster Transfer Windows, with explicit Admin-controlled transitions.
- A Season sporting lifecycle of Preparing, Active, Completed, Cancelled, or Abandoned, with activation gated by a valid format, approved entries, and a ready opening stage.
- Overlapping Active Seasons where needed, while each Competition has only one Admin-designated Current Season.
- Distinct cancellation before the first official Match and abandonment after play has begun, with preserved history and reasons.
- Explicit Season completion after all stages and federation rulings are finalized, followed by a public historical archive.
- Exceptional audited reopening of a Completed Season when a later federation decision changes sporting information.
- Audited reopening of a Season's registration windows without changing its sporting lifecycle.
- League stages, Group Stages, Knockout stages, and Hybrid Formats.
- One-match and two-leg Knockout Ties, with an optional Third-place Match.
- Versioned Tie Resolution Rules per Knockout Round, with exceptions requiring a Format Amendment.
- Direct Penalty Shootout as the default resolution of a drawn one-match Tie, with explicitly configured extra time or Replay Match as optional alternatives.
- Two-leg Ties decided by Aggregate Score and then a direct Penalty Shootout, without extra time or an away-goals rule.
- Separate Regulation, extra-time, Played Score, and Penalty Shootout values so shootout kicks never affect aggregate or goal statistics.
- Byes that advance Qualification Slots without fictional Matches or Technical Results.
- External federation draws recorded as validated Draw Outcomes with pots, pairing constraints, bracket slots, and explicit home or away order.
- Fixed brackets and redraw-after-each-round progression, including unresolved source slots published before their Season Entries are known.
- Knockout Ties progressing through Configured, Ready, In Progress, Awaiting Finalization, and explicitly Finalized states.
- Penalty Shootout summaries that store only successful-kick totals and winner.
- At most one optional Replay Match for a one-match Tie, with immediate penalties as its default draw resolution.
- Audited Tie Rulings that determine advancement without inventing a Match score.
- Superseding Tie Rulings and explicit reopening when a later federation decision changes a Finalized Tie.
- Independent Tie suspension that blocks further play and finalization while preserving completed Match Results.
- Aggregate Scores derived from current official Match Results, including applicable Technical Results and excluding Penalty Shootouts.
- Confirmed Byes that fill destination slots without creating fictional or Finalized Ties.
- Supersedable Draw Outcomes before play, while post-start redraws require a Format Amendment and federation decision.
- Finals and Third-place Matches modeled as one-match Ties with placement outputs rather than advancing participants.
- Placement Outputs created only when a Final or Third-place Match is explicitly Finalized.
- Knockout Stage finalization gated by completed Ties, confirmed Byes, settled rulings, valid outputs, and no suspended or missing slots.
- Immutable Final Knockout Snapshots preserving the bracket, Draw Outcomes, Byes, rulings, and outputs used at finalization.
- Multiple valid format configurations for the same Team count, with the federation's approved format selected and configured by the Admin.
- Reusable Format Templates for common structures, with editable groups, rounds, Legs, progression rules, and placement matches per Season.
- Audited Format Amendments when the federation changes an active Season's structure, including adding or removing a Third-place Match.
- Private validation and explicit atomic publication of Format Amendments, with affected Stage transitions and previous format versions preserved.
- External Team applications recorded and decided by the Admin, with approved applications creating season-specific entries whose suspension, withdrawal, or disqualification preserves history.
- Independently approved Player registrations represented by persistent identities and collected into Season Rosters without permanent or season-wide shirt numbers.
- Regulation-defined Roster Transfer Windows for non-overlapping, effective-dated Team changes within a Season, without commercial transfer-market data.
- Admin-assigned season-specific Legionnaire classification, Team roster quotas, and optional allowances configured from Player birth-date cutoffs.
- Blocked out-of-window or over-quota registrations unless the federation records an audited Roster Eligibility Ruling.
- Configurable minimum and maximum Season Roster sizes, with the minimum required before a Team is ready for competition.
- Private application and eligibility documents, public verification outcomes, and privacy-preserving Player profiles that hide exact birth dates by default.
- Manual, audited duplicate Player merges and versioned roster rules whose changes trigger review rather than silently cancelling registrations.
- Matches generated from Competition Formats or entered manually by an Admin and validated against the Stage structure.
- Manually entered official Matches linked to valid Fixture Slots; additions outside an Active format require a Format Amendment.
- Fixture Rounds as structural groups whose Matches may occur on different days and at different times.
- Independent Match sporting state and Private or Public visibility, including Unscheduled, Scheduled, Postponed, In Progress, Finished, and Cancelled states.
- Season-default IANA timezone with Match-level override and separately supported date TBD and time TBD schedules.
- Scheduled Kickoff as the authoritative published time, with optional Actual Kickoff for relevant ceremonies or delays and no required Actual End.
- Reusable Venues with locality, address, optional coordinates, and Venue TBD.
- Reusable Playing Fields within a Venue so distinct fields may host Matches concurrently.
- Explicit home, away, or neutral Venue Designation while every Match retains Home and Away participant roles.
- Home Matches remaining home when moved to an alternate Venue or Playing Field; only explicit federation designation makes a Match neutral.
- Single or double round-robin generation with a Rest Slot for the resting participant, localized as `Вихідна` in the Ukrainian UI, plus Home/Away balancing, optional date proposals, and explicit Admin confirmation.
- Publication by Match, Fixture Round, Knockout Round, or Stage with preserved Schedule Revisions.
- Schedule validation for participant overlap, source finalization, and format consistency, plus reasoned overrides for rest and Venue timing warnings.
- Multiple Matches on the same playing field and day when their occupancy intervals and configured turnaround time do not overlap.
- Field Occupancy Windows derived from Scheduled Kickoff, expected duration, and turnaround rather than a required Actual End.
- Explicit Match state transitions, including Suspended Match for play that began but awaits a federation decision.
- Mandatory internal reasons and optional public explanations for published Schedule Revisions, postponements, cancellations, and suspensions.
- Regeneration only before first publication; later changes use Schedule Revisions or a Format Amendment.
- Schedule Revisions for kickoff, Venue, Playing Field, or Home/Away changes, while structural fixture changes after Stage activation require a Format Amendment.
- Suspended Matches that can resume as the same Match, finish by ruling, or produce a separately linked Replacement Match.
- Physical deletion limited to unpublished, unstarted, dependency-free Private Matches.
- Partial schedule publication with Public TBD fixtures while later rounds remain Private.
- Historical Venue and Playing Field details preserved through Schedule Revisions rather than rewritten by later venue changes.
- Downloadable read-only iCalendar exports for Public Competition or Season schedules, with stable events across changes and explicit cancellation.
- Match Results entered and confirmed manually by an Admin.
- Played Scores preserved separately from federation-assigned Technical Results, with the current official Match Result driving progression and Standings.
- Final federation rulings recorded by the Admin, while protest submission and review remain outside the platform.
- Technical Results for unplayed Matches, such as a `0:3` decision after a Team fails to appear, without inventing a Played Score.
- Admin-entered technical scores that reproduce federation rulings rather than values inferred automatically by the platform.
- Appealed Result Rulings that can replace a Technical Result or restore the Played Score while preserving the full decision history.
- Explicit Admin finalization of Knockout Ties before their winning Teams can enter dependent Matches; deadlines do not finalize progression automatically.
- Explicit Admin finalization of every Competition Stage before its advancing Teams enter a dependent stage.
- Competition Stage progression through Configuring, Ready, Active, Awaiting Finalization, and Finalized states.
- Exceptional audited reopening of a Finalized Stage, restricted once a dependent Stage has become Active.
- Removal of an unstarted Stage and abandonment of a started Stage as distinct, history-preserving Format Amendment outcomes.
- Admin-controlled lifecycle transitions; dates and completed Matches produce reminders and readiness signals, never automatic state changes.
- Standings derived from confirmed results and explicit federation adjustments.
- Versioned Ranking Rules per League or Group Stage, with a configurable win/draw/loss Points Scheme defaulting to `3/1/0`.
- Ordered configurable Tie-breakers, including overall, head-to-head, away-goal, fair-play, Playoff Match, and final federation ruling criteria.
- Recursive head-to-head mini-tables, provisional shared positions, and explicit unresolved-tie gates before Stage finalization.
- Configurable Match-level card weights for Fair-play Score without requiring detailed Player event statistics.
- Audited corrections to Match-level Disciplinary Summaries with recalculation and reopening when sporting outcomes change.
- Playoff Matches that settle tied positions without contributing points or goals to the main Standings.
- Declarative qualification by configured positions, per-group places, cross-group ranking, named destination slots, seeding, and byes.
- Audited Qualification Rulings that preserve calculated Standings when an ineligible participant must be replaced, left vacant, or converted to a bye.
- Configurable cross-group comparison using all Matches, exclusion of results against lowest-ranked participants, or exact per-Match ratios.
- Reasoned Standing Adjustments that add or deduct points without directly editing calculated Match totals or positions.
- Cumulative, revocable, and supersedable Standing Adjustments whose previous decisions remain immutable.
- Immutable Final Standings Snapshots and Qualification Outputs produced by explicit Stage finalization.
- Validation that every active Stage has a complete Tie-breaker chain and valid Qualification Slots.
- Categorized Ukrainian-language News Articles with Draft, Scheduled, Published, and Archived states, authenticated preview, automatic or manual publication, and correction history.
- Versioned structured rich-text content stored as validated JSON, rendered through the same controlled semantic component mapping for authenticated preview and server-rendered public pages.
- Supported article blocks for paragraphs, H2-H3 headings, emphasis, lists, links, quotations, accessible tables, inline images, and validated YouTube references, without arbitrary HTML, scripts, or styles.
- Stable article URLs, editable SEO fallbacks, archive discovery, and optional time-bounded Featured promotion without manual ordering of the entire feed.
- Explicit associations between News Articles and multiple Competitions, Seasons, Teams, Matches, and Players.
- One cover image and multiple inline images per article, with required accessibility classification and media attribution metadata.
- Reusable immutable Media Assets with contextual alt text and captions, private originals, optimized public variants, safe YouTube references, and no arbitrary embeds.
- JPEG, PNG, and WebP uploads up to 10 MB, stripped of EXIF metadata and processed into responsive formats using a non-destructive focal point.
- Physical deletion limited to never-published Draft Articles; published content and its revisions remain preserved.
- Immutable first-publication timestamps, with a separate original publication timestamp reserved for future historical imports.
- Published Articles archived rather than returned to Draft; restoration retains their stable URL and original publication time.
- Working Revisions that leave the current Published Revision visible until an explicit, reasoned publication action, with public explanations for material Article Corrections.
- Server-authoritative Draft autosave, limited recovery snapshots, and optimistic concurrency that prevents stale editing sessions from silently overwriting newer work.
- Readiness validation when scheduling and again at publication time, with invalid scheduled attempts exposing no partial content and remaining available for Admin attention.
- Versioned content schemas, accessible table constraints, HTTPS-only links, safe YouTube references, and explicit indexing rules for every editorial state.
- Media Withdrawal for exceptional rights-related removal, substituting a public placeholder while preserving metadata and audit history.
- Audit history for corrections to published Official information.
- Multiple Admin identities sharing one Admin role, provisioned through revocable Clerk invitations while public registration remains disabled.
- Persistent Admin Identities separated from historical Admin Access Grants so revocation preserves authorship and later reappointment creates a new grant.
- Mandatory Admin MFA using an authenticator application and backup codes.
- Server-side authorization at every protected read and mutation, requiring both a valid completed Clerk session and an Active PostgreSQL Admin record.
- Invited, Active, Suspended, and Revoked Admin access with immediate local denial, Clerk session revocation, preserved authorship, and last-Admin lockout protection.
- Idempotent Clerk webhook synchronization that never replaces server-side authorization and fails closed while an identity is unmatched.
- Immutable Audit Events for access changes, authorization denials, Official-information mutations, rulings, lifecycle transitions, exceptional overrides, scheduled operations, and private-document access.
- Audit records containing actor, action, target, timestamp, structured change, reason, reference, correlation, source, and outcome without credentials or private file contents.
- Atomic domain mutations and Audit Events, with requested and succeeded or failed events around non-transactional Clerk and object-storage operations.
- Filterable Admin audit views and CSV export, append-only application behavior, restricted database permissions, and no Admin impersonation.
- Security-only capture of network and client context, with its exact retention deferred to the production privacy and operations decision.
- Seven-day Admin invitations with explicit resend or revoke-and-replace handling and preserved invitation history.
- Configurable 12-hour maximum Admin sessions and 30-minute inactivity expiry, plus recent identity reverification for sensitive security and bulk-private-data operations.
- Controlled MFA recovery by another Active Admin or a documented Break-glass Procedure, always with session revocation and an audited reason.
- One-time first-Admin bootstrap that is unavailable after activation, plus reasoned email notifications for access-state changes.
- External Sync Pending retries that preserve immediate local denial, and Reconciliation Required handling for Clerk Dashboard changes missing federation context.

## Server-side module boundaries

- Competition owns Competitions, Seasons, Competition Formats, Competition Stages, their rules, and sporting lifecycles.
- Registration owns Teams, Players, Season Applications, Season Entries, Rosters, registration and transfer windows, and eligibility decisions.
- Match owns Fixture Slots, Matches, scheduling, Venues, Match Results, and match-level rulings.
- Standings & Progression owns derived Standings, Standing Adjustments, qualification, knockout progression, and final snapshots.
- Editorial owns News Articles, categories, revisions, and publication; Media separately owns Media Assets, variants, metadata, and the object-storage lifecycle.
- Identity & Access owns Admin Identity, grants, invitations, and Clerk synchronization.
- Governance owns Audit History, Privacy Requests, Legal Holds, and the privacy-deletion ledger; Operations owns Incident Records and recovery verification.
- Every persistent record has one owning module. Other modules use its application interface rather than importing its repository or mutating its tables.
- The modules share one PostgreSQL database and may use cross-module foreign keys for referential integrity, but cross-module cascading deletion is prohibited.
- Cross-module workflows are coordinated by server-side application orchestrators. Critical Official-information changes and their Audit Events commit in one PostgreSQL transaction.
- Clerk, object storage, notifications, cache revalidation, media processing, analytics, and monitoring use idempotent asynchronous coordination, retry, and reconciliation outside the critical database transaction.
- Server-side boundaries do not mirror the existing Redux slices. Redux is limited to local UI state and optional non-authoritative client caching.
- Competition, Season, Competition Stage, and each versioned Competition Format are separate aggregate roots; Competition owns the single Current Season designation.
- A Format Amendment creates and atomically activates a new validated Format version instead of editing the active version in place.
- Match owns sporting state, visibility, schedule and its revisions, Played and Technical Result history, and match-level Result Rulings; Venue remains an independent reusable aggregate.
- Standings are calculated from Match Results and Stage rules rather than manually edited. Knockout Tie owns its lifecycle, Tie Rulings, and winner output, while immutable final standings, qualification, and knockout snapshots preserve finalized evidence.
- Team and Player Identity are independent roots. Season Application owns its decision lifecycle, while one Season Roster per Season Entry controls Roster Entries, size limits, and Legionnaire quotas.
- News Article controls its lifecycle and immutable revisions; Category remains independent. Media Asset controls its original metadata, processing, variants, defaults, and withdrawal, while contextual placement belongs to an Article Revision.
- Admin Identity, Admin Invitation, Admin Access Grant, Privacy Request, Legal Hold, and Incident Record are independent roots. Audit Event is an append-only transaction participant rather than an editable aggregate.
- Cross-aggregate references use stable identifiers by default. Immutable snapshots are reserved for information whose published or approved historical representation must not change.
- Mutable aggregates use optimistic versions. Stale Admin commands fail with an explicit conflict and are never silently merged.
- Short PostgreSQL row or advisory locks protect cross-aggregate invariants such as Current Season designation, roster transfer, Stage or Tie finalization, Format Amendment, last-Admin protection, Fixture Slot assignment, and bulk schedule publication.
- Stage finalization atomically validates input versions, creates final snapshots and progression outputs, changes state, appends its Audit Event, and enqueues post-commit effects.
- Changing an Official Match Result atomically invalidates affected calculations and cache state; a Finalized Stage must follow its reopening workflow first.
- Current Standings are calculated server-side and may be cached. Only their authoritative inputs and explicitly finalized snapshots are persisted as sporting truth.
- Important mutations use a command idempotency key. The same key and payload returns its prior outcome, while reuse with a different payload is rejected.
- Critical invariants are expressed in both domain validation and PostgreSQL constraints where possible.
- A transactional outbox captures external work in the committing business transaction; idempotent workers perform and retry Clerk, storage, notification, cache, media, and scheduled operations only after commit.
- Media upload uses an expiring Upload Intent, a private temporary object, and explicit database activation; cleanup removes abandoned uploads.
- Automatic retry is limited to safe idempotent commands after transient serialization or deadlock failures. Domain, validation, and stale-version conflicts return to the Admin.
- Successful protected mutations commit with their Audit Event. Denied or failed attempts are appended separately after rollback; if Audit History is unavailable, protected mutations fail closed.
- Critical cross-module invariants use synchronous application orchestration in a shared transaction; asynchronous events are limited to post-commit effects and derived projections.
- A server-only Query Layer may join module-owned tables to build public and Admin view models, but it is strictly read-only and owns no domain state.
- The Shared Kernel is limited to stable IDs, UTC time, pagination, actor and correlation context, transaction boundaries, and common result or error primitives; it contains no shared mutable domain entities.
- Domain modules do not import one another. Application orchestrators call their public ports, infrastructure implements private repositories, and Next.js routes and components depend on application commands and queries.
- Season activation locks the Season and revalidates the referenced Format, opening Stage, and participant-set versions before changing state.
- A validated Format Amendment Plan applies Competition, Match, and Progression changes atomically; a partially applied format is invalid.
- Privacy Request execution is an audited multi-step process: it checks Legal Holds, commits database changes, dispatches external deletion and cache work through the outbox, and resolves only after required effects complete.
- Cross-module foreign keys restrict deletion. Historical references use archive, withdrawal, supersession, or privacy restriction instead of cascading physical deletion.
- Publication and Official-result changes commit before versioned cache-tag revalidation. Temporary stale reads follow the Portal's Graceful Degradation rules.
- Article publication validates that every referenced Media Asset is Active, not withdrawn, and has ready public variants without calling object storage inside the transaction.
- Expensive finalization calculations produce a candidate from recorded input versions before taking locks; a short transaction revalidates those versions and either commits the snapshot or returns a conflict.
- Failed post-commit effects do not reverse an accepted domain decision. They remain External Sync Pending, retry idempotently, and escalate to reconciliation when exhausted.
- Module ports, commands, and query contracts are framework-neutral TypeScript without React, Next.js request objects, or ORM entities, allowing future HTTP adapters or extraction.

## Production constraints

- Low expected local-federation traffic, with a baseline capacity of 100 concurrent public requests and 10 Admin sessions primarily absorbed through public-content caching.
- A cost-first hosting posture that uses the least expensive production configuration which still satisfies the agreed availability, recovery, backup, privacy, and security constraints; higher capacity is added only when observed demand requires it.
- Public Portal availability SLO of 99.5% per month excluding announced maintenance, with cached Published information prioritized during partial failure.
- Public performance targets at the 75th percentile of LCP up to 2.5 seconds, INP up to 200 milliseconds, CLS up to 0.1, and cached server responses up to 500 milliseconds.
- Disaster-recovery targets of RPO up to 15 minutes and RTO up to four hours, covering PostgreSQL, Media Assets, deployment configuration, secret-recovery procedure, and Clerk/webhook runbooks.
- A named Technical Operator responsible for deployment, monitoring, backup, and restoration, while an Admin validates recovered Official information.
- A cost-first production envelope targeting USD 10–20 per month, with any recurring infrastructure cost above USD 25 requiring an explicit decision; domain and transactional email costs are tracked separately.
- Seven days of point-in-time database recovery, 14 days of daily backups, and six months of monthly backups, with an isolated restore test each quarter and before a high-risk data migration.
- Permanent federation archives for Published competition history and Audit History, with time-limited retention and review for private registration data, supporting documents, Privacy Requests, abandoned drafts, and orphaned Media Assets.
- Application logs retained for 30 days, Security Events for 90 days, and aggregated non-personal operational metrics for 12 months; Player personal data is excluded from logs.
- Legal Holds that suspend scheduled deletion for information required by a protest, investigation, or legal obligation and record the reason in Audit History.
- Co-located European production services, encrypted connections, and isolated Development, Preview/Staging, and Production data, identity, storage, secrets, and webhook boundaries.
- Synthetic or anonymized non-production Player data; Production personal data is never copied into preview environments.
- Ukrainian-only MVP presentation using Unicode, `DD.MM.YYYY`, 24-hour time, `Europe/Kyiv` display, and UTC storage, while user-facing strings remain externalizable.
- WCAG 2.2 AA as the accessibility acceptance target for both the public Portal and Admin interface.
- Minimal Player Public Profiles that exclude exact birth date, federation identifier, contacts, address, and supporting documents.
- A stricter publication gate for Players under 18, requiring a recorded lawful basis or representative consent with scope and revocation history for a photo and full public profile.
- Private audited Privacy Requests acknowledged within five business days and resolved within 30 calendar days through explicit workflow states and a reasoned outcome.
- No advertising, tracking pixels, or behavioral profiling in the MVP; public analytics remains minimal and cookieless, while Clerk cookies serve Admin authentication only.
- Graceful degradation that keeps cached Published information readable while blocking unsafe mutations or publication when PostgreSQL or Audit History is unavailable.
- Monitoring for public and Admin availability, errors, latency, storage and database capacity, backups, Clerk webhooks, scheduled publication, certificate expiry, and infrastructure cost.
- Severity-based incident handling with a one-hour response target for data exposure, corruption, or total outage; four hours for Admin outage or public degradation; and the next business day for minor incidents.
- Technical incident recovery owned by the Technical Operator and Official-information validation and federation communication owned by an Admin, even when one person initially performs both responsibilities.
- Email alerts for the Technical Operator and an optional immediate channel such as Telegram for critical incidents.
- Security-update targets of 72 hours for critical fixes, 14 days for high-risk fixes, and monthly review for other dependencies.
- CDN caching and request, upload, and database-query limits, with verified Clerk webhook signatures.
- Privacy deletions applied to the live system and cache, recorded for reapplication after a backup restore, while immutable backups expire under their retention schedule.
- Cached pages marked with their last-updated time and a stale-data warning when currentness cannot be confirmed.
- Admin validation of restored Official information before mutations and scheduled publication are unblocked.
- Approximately 48 hours' public notice for planned maintenance that affects Visitors.
- Documented export of PostgreSQL data, original Media Assets, and configuration to avoid provider-specific lock-in.
- Support for the current two major versions of Chrome, Edge, Firefox, and Safari, including responsive mobile access and server-rendered critical public information.
- Backward-compatible database migrations, pre-change backups for high-risk migrations, deployment health checks, and a tested rollback path.
- Automated accessibility checks during development plus manual keyboard and screen-reader verification of critical public and Admin flows before release.

Commercial transfer-market features, contracts, fees, budgets, player market values, detailed player statistics, public accounts, additional administrative roles, in-platform voting, and protest case management are outside the initial MVP.

## Current state

The checked-in application is still the original Vite, React, Redux Toolkit, and `redux-persist` learning prototype. Its browser-persisted league data is not production architecture and must not become the source of Official information.

The migration to Next.js and PostgreSQL has been designed but not yet implemented. Existing presentational components and useful tests may be migrated selectively; simulator-specific state and behavior will be retired.

Current prototype commands:

```bash
pnpm install
pnpm dev
pnpm test:run
pnpm build
```

## Project documentation

- [Domain language](./CONTEXT.md)
- [Architecture decisions](./docs/adr/)
- [Central data architecture research](./docs/research/central-data-architecture-options.md)

The accepted application shape is recorded in [ADR-0011](./docs/adr/0011-use-a-single-nextjs-modular-monolith.md). It supersedes the earlier decision to build a separate REST API.
