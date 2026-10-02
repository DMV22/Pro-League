# Editorial, Media, Access, Governance, and Operations schema inventory (#71)

The [relational schema blueprint](./relational-schema.md) owns the domain requirements. This inventory maps its remaining tables to Drizzle descriptions in PostgreSQL schema `app`. The [coverage test](../../src/modules/schema-coverage.test.ts) checks every named table and core metadata. #71 does **not** generate SQL, apply a migration, connect Clerk or storage, or implement workflows.

## Table ownership and classification

| Owner | Tables | Classification and access boundary |
| --- | --- | --- |
| Editorial | `news_articles`, `article_categories`, `article_working_copies`, `article_publication_schedules` | Optimistically versioned roots and working state; drafts and schedules are Admin-only. |
| Editorial | `article_slugs`, `article_revisions`, `article_state_transitions`, `article_category_versions`, `article_category_state_transitions`, `featured_article_decisions` | Insert-only history and decisions. Published revisions are reproducible; old slugs remain reserved. |
| Editorial | `article_competition_associations_working`, `article_season_associations_working`, `article_team_associations_working`, `article_match_associations_working`, `article_player_associations_working` | Mutable, explicitly typed draft associations. A text mention is not an association. |
| Editorial | `article_competition_associations_revision`, `article_season_associations_revision`, `article_team_associations_revision`, `article_match_associations_revision`, `article_player_associations_revision` | Insert-only associations captured for a specific Published Revision. |
| Editorial | `article_recovery_snapshots`, `article_media_placements_working`, `article_media_placements_revision` | Temporary recovery state, mutable draft placement, and immutable published placement respectively. Recovery data never becomes Official information by itself. |
| Media | `media_upload_intents`, `media_assets`, `media_processing_attempts` | Private upload/processing workflow and mutable public-asset identity. Binary objects remain outside PostgreSQL. |
| Media | `media_asset_metadata_versions`, `media_presentations`, `media_asset_variants`, `media_asset_state_transitions`, `media_withdrawal_decisions`, `media_storage_tombstones` | Insert-only versions, decisions, and storage evidence. Published media history is not silently deleted. |
| Identity & Access | `admin_identities`, `admin_external_identities`, `admin_invitations`, `admin_access_grants`, `admin_sessions`, `external_identity_events`, `external_sync_operations`, `reconciliation_items` | Private identity, local authorization, provider mapping, session-hash metadata, and retry/reconciliation state. No credentials or raw tokens. |
| Identity & Access | `admin_access_state_transitions`, `privileged_operation_records` | Immutable access history and private operator evidence. Clerk authentication alone never authorizes Admin access. |
| Governance | `audit_events`, `audit_event_targets`, `audit_event_changes`, `supporting_references`, `private_document_versions`, `privacy_request_transitions`, `privacy_request_actions`, `legal_hold_targets`, `retention_policies`, `privacy_deletion_ledger` | Restricted insert-only Audit, evidence, decision, and retention history. Supporting References can point at a Private Document version but are not documents themselves. |
| Governance | `security_event_contexts`, `private_documents`, `private_document_upload_intents`, `privacy_requests`, `privacy_request_items`, `legal_holds`, `retention_candidates` | Private, mutable workflows with retention and Legal Hold checks. Private Documents never share public Media Asset keys or access paths. |
| Operations | `outbox_messages`, `command_executions`, `scheduled_jobs`, `cache_invalidation_intents`, `inbound_webhook_receipts`, `notification_deliveries`, `incident_records`, `operational_alerts` | Bounded operational queues/state; typed, sanitized payloads and scoped idempotency. |
| Operations | `job_runs`, `incident_state_transitions`, `recovery_verifications`, `restore_validations` | Insert-only attempt, incident, and restore evidence. |

`article_*_associations_working` and `article_*_associations_revision` in the blueprint expand to five concrete typed tables each; this retains restrictive FKs to Competition, Season, Team, Match, and Player. It avoids a generic target-type/target-ID pair for public article associations. The `privacy_deletion_ledger` records a restore reapplication as a new row referencing the prior ledger entry, rather than updating permanent evidence.

## Declared in Drizzle versus required in #72

- Described now: application-generated UUID keys, optimistic root versions, typed association FKs, normalized article-slug reservation, provider event and command idempotency keys, a partial unique index for a current non-revoked Admin Grant, basic state/positive-value/typed-source checks, and indexes for due queues and private-record lookup.
- Review in the first complete SQL migration: composite owner-safe current pointers, uniqueness of active publication/feature decisions, valid public Article revision/Category/Media presentation, valid Private Document owner, external HTTPS URL validation, expiry/retention schedules, and cross-module references still represented by bare UUIDs (authors, actors, Supporting References). Row-local `CHECK`s cannot replace whole-workflow validation.
- The Access Grant partial index limits one non-revoked grant per Admin Identity. The last-Active-Admin invariant additionally needs an ordered lock and transaction-time count; an index cannot prove it.
- For Audit History, decisions, published revisions, Private Document versions, and permanent deletion evidence, #72 must add insert-only database grants/triggers. Drizzle table shape alone does not prevent UPDATE, DELETE, or TRUNCATE.
- The `app_public_reader` role must be restricted to reviewed public views of Published Articles and active Media metadata. It must not read Article drafts, Admin/Clerk metadata, Private Documents, Supporting References, Privacy Requests, Legal Holds, security context, raw queues, or Audit details.
- The `app_runtime` role writes owning domain tables and may insert/select Audit History but must not mutate it afterward. The `app_worker` receives narrow queue/integration privileges; `app_migrator` owns reviewed DDL; `app_drift_reader` reads metadata only. No role/grant SQL is installed by #71.

## Retention and private-data review for #72

| Data | Intended handling |
| --- | --- |
| Published Articles, decisions, Official links, Audit History | Permanent; supersede, archive, or restrict instead of rewriting. |
| Never-published drafts and recovery snapshots | Bounded; remove only after dependency and Legal Hold checks. |
| Public Media originals/variants | Orphan cleanup after 30 days; published withdrawal preserves metadata and tombstone evidence. |
| Supporting application/eligibility Private Documents | Three years after Season unless Hold/policy requires longer. |
| Security event context | Delete after 90 days, retaining the base Audit Event. |
| Privacy Requests | Private, retained five years. |
| Processed outbox, command idempotency, ordinary operational recipient data | Normally expire after 30 days when permanent evidence exists. |
| Privacy deletion ledger | Permanent opaque/keyed identifiers only; reapply deletion before restored data is served. |

No personal details belong in outbox payloads, command outcomes, audit diffs, logs, or webhook receipts. The provider owns credentials and session tokens. Article content remains schema-versioned JSONB rather than arbitrary HTML; public rendering must validate it. The Security Review gate in [ADR-0025](../adr/0025-use-clerk-hobby-and-defer-mandatory-mfa.md) still applies before real Private Documents or a second Admin are enabled.
