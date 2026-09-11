---
status: accepted
---

# Partition domain modules and consistency boundaries

ProLeague will remain one Next.js modular monolith and one PostgreSQL database, but its server-side model will be partitioned by explicit ownership rather than by routes, screens, ORM relations, or the existing Redux slices. Each persistent record has one owning module, cross-module writes pass through application orchestrators, and only invariants that define one accepted Official-information decision share a database transaction.

## Module ownership

| Module | Owns |
| --- | --- |
| Competition | Competition, Season, versioned Competition Format, Competition Stage, stage rules, and sporting lifecycle |
| Registration | Team, Player Identity, Season Application, Season Entry, Season Roster, Roster Entry, registration and transfer windows, and eligibility decisions |
| Match | Fixture Slot, Match, Venue, scheduling and Schedule Revision, Match Result, and match-level Result Ruling |
| Standings & Progression | derived Standings logic, Standing Adjustment, Knockout Tie and Tie Ruling, Draw Outcome, qualification and placement outputs, and final standings or knockout snapshots |
| Editorial | News Article, Category, Article Revision, Article Media Placement, and publication lifecycle |
| Media | Media Asset, Upload Intent, processing state, variants, default accessibility metadata, storage lifecycle, and Media Withdrawal |
| Identity & Access | Admin Identity, Admin Invitation, Admin Access Grant, Clerk mapping and synchronization state |
| Governance | Audit History, Privacy Request, Legal Hold, privacy-deletion ledger, and retention coordination |
| Operations | Incident Record and recovery-verification records |

Competition, Season, Competition Stage, and each versioned Competition Format are separate aggregate roots. Competition alone controls its Current Season designation. Applying a Format Amendment creates and activates a new validated format version rather than editing the active version in place.

Match owns its sporting state, visibility, schedule and revisions, Played and Technical Result history, current Official Match Result, and match-level Result Rulings. Venue remains independently reusable. Knockout Tie instead belongs to Standings & Progression because its lifecycle, Tie Rulings, and winner output concern the whole pairing rather than one Match.

Team and Player Identity are independent roots. Season Application owns its decision lifecycle, and one Season Roster per Season Entry controls Roster Entries, size limits, and Legionnaire quotas. A Roster Transfer coordinates the source and destination Rosters plus the Player's Season registration.

News Article controls its lifecycle and immutable revisions, while Category is independent. Media Asset controls upload, processing, variants, defaults, withdrawal, and storage state; contextual alt text and captions belong to the Article Media Placement in an Article Revision.

Admin Identity, Admin Invitation, Admin Access Grant, Privacy Request, Legal Hold, and Incident Record have independent lifecycles. Audit Event is append-only transaction evidence rather than an editable aggregate.

## Dependency and data-access rules

Only an owning module mutates its tables. Domain modules do not import each other or another module's repositories. Framework-neutral application orchestrators call module ports, infrastructure implements the repositories, and Next.js routes, Server Actions, Route Handlers, and React components call application commands or queries rather than domain persistence.

All modules share PostgreSQL. Cross-module foreign keys are allowed for referential integrity but use restrictive deletion rather than cascades. References normally store stable identifiers; immutable snapshots duplicate names or representations only where approved or Published history must remain reproducible.

A server-only Query Layer may perform read-only joins across module-owned tables to build public and Admin view models. It owns no state and cannot become an alternative write path. Module ports, commands, and query contracts contain no React, Next.js request objects, or ORM entities, allowing a later HTTP adapter or module extraction without duplicating business rules.

The Shared Kernel is limited to stable branded identifiers, UTC timestamps, pagination, actor and correlation context, transaction abstractions, and common result or error primitives. It contains no shared mutable Competition, Season, Team, Player, Match, or Article model.

## Consistency matrix

| Workflow or invariant | Consistency mechanism |
| --- | --- |
| Any accepted protected mutation and its Audit Event | One PostgreSQL transaction; mutation fails closed if audit cannot commit |
| Denied or failed protected attempt | Domain transaction rolls back; immutable failure Audit Event is appended separately |
| One Current Season per Competition | Competition version plus database constraint and short row lock |
| Season activation readiness | Lock Season; revalidate Format, opening Stage, and participant-set versions; commit state and audit atomically |
| Format Amendment affecting stages, slots, or progression | Prevalidated plan; short shared Competition, Match, and Progression transaction; no partial application |
| Approve Season Application and create Season Entry | One Registration transaction with uniqueness constraints and audit |
| Activate or transfer Player registration | Lock Player-season key and affected Season Rosters in stable order; validate dates, roster limits, and Legionnaire quota; commit atomically |
| Assign Fixture Slot or bulk-generate and publish schedule | Optimistic versions, uniqueness constraints, ordered locks, all-or-nothing publication unit, and audit |
| Confirm or supersede Match Result | Update the Official Result and invalidate dependent calculations atomically; finalized stages require the reopening workflow |
| Finalize Knockout Tie | Lock Tie and relevant Match inputs; validate result and ruling versions; write winner output, state, and audit atomically |
| Finalize Competition Stage | Build candidate calculation from versioned inputs, then lock and revalidate; atomically write final snapshot, qualification outputs, state, audit, and outbox |
| Publish Article Revision | Lock or version Article; validate Category and active Media Assets; atomically select Published Revision, state, timestamp, audit, and outbox |
| Revoke Admin access | Commit immediate local denial, audit, and Clerk-revocation outbox message atomically |
| Apply Privacy Request | Audited process checks Legal Holds, commits database steps, dispatches storage/cache work through outbox, and resolves only when mandatory steps complete |
| Physical deletion with cross-module references | Foreign-key restriction and explicit dependency check; otherwise archive, withdraw, supersede, or restrict |
| Clerk webhook or scheduled job | Stable external or deterministic idempotency key, atomic claim, current-state check, retry, and reconciliation |
| Media upload | Expiring Upload Intent, private temporary object, verified activation, idempotent processing, and orphan cleanup |
| Cache revalidation, notification, storage, Clerk, or media processing | Transactional outbox after the domain commit; at-least-once delivery with idempotent handlers |

## Concurrency and idempotency

Every mutable aggregate uses optimistic versioning. Admin commands carry the expected version, and stale commands return an explicit conflict instead of silently merging or overwriting Official information. Short row or advisory locks are reserved for cross-aggregate invariants such as Current Season selection, roster transfer, finalization, Format Amendment, last-Active-Admin protection, Fixture Slot assignment, and bulk schedule operations. Locks are acquired in a stable order.

Important mutations carry a command idempotency key. Repeating the same key and payload returns the recorded outcome; reusing the key with a different payload is rejected. PostgreSQL unique, check, and exclusion constraints protect critical invariants in addition to domain validation.

Automatic retry is limited to transient serialization or deadlock failures for idempotent commands with unchanged payloads. Stale versions, domain conflicts, changed federation decisions, and validation failures return to the Admin.

Expensive standings or bracket calculations use versioned inputs to prepare a candidate before locks are taken. The committing transaction revalidates every relevant version and either writes the immutable snapshot or reports a conflict, keeping locks short without accepting mixed evidence.

## External coordination

External APIs are never called inside an open domain transaction. The same transaction that accepts a business change writes its outbox messages. Workers claim messages and scheduled work atomically, use deterministic idempotency keys, retry safely, and expose exhausted work for reconciliation.

A failed post-commit effect does not reverse an already accepted domain decision. Clerk, storage, notification, media-processing, and cache failures remain External Sync Pending until resolved. Cache invalidation follows the database commit through versioned tags; temporary stale public reads are allowed only under the documented Graceful Degradation behavior.

Media upload uses an expiring Upload Intent, a private temporary object, verification and database activation. Article publication validates the active, non-withdrawn Media Asset and ready public variants from PostgreSQL rather than calling object storage during publication.

Privacy Request execution is a long-running audited process rather than one database transaction. Governance records the approved plan and Legal Hold checks, coordinates atomic database mutations, queues external deletions and cache work, and marks the request Fulfilled only after mandatory effects succeed. Preserved Official history results in a reasoned Partially Fulfilled outcome.
