import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

import { adminIdentities } from '../../identity-access/infrastructure/schema'
import { immutableRecordColumns, mutableRecordColumns } from '../../../server/db/columns'
import { appSchema } from '../../../server/db/schema'

// Audit rows contain redacted evidence, never credentials, private file contents, or raw webhook payloads.
export const auditEvents = appSchema.table(
  'audit_events',
  {
    ...immutableRecordColumns(),
    sequenceNumber: bigint('sequence_number', { mode: 'bigint' }).generatedAlwaysAsIdentity(),
    actorKind: text('actor_kind').notNull(),
    actorAdminIdentityId: uuid('actor_admin_identity_id').references(() => adminIdentities.id, {
      onDelete: 'restrict',
    }),
    actorDisplaySnapshot: text('actor_display_snapshot').notNull(),
    actorEmailSnapshot: text('actor_email_snapshot'),
    action: text('action').notNull(),
    outcome: text('outcome').notNull(),
    reason: text('reason'),
    source: text('source').notNull(),
    correlationKey: text('correlation_key'),
    commandKey: text('command_key'),
  },
  (table) => [
    unique('audit_events_sequence_uq').on(table.sequenceNumber),
    index('audit_events_actor_time_idx').on(table.actorAdminIdentityId, table.recordedAt),
    index('audit_events_action_time_idx').on(table.action, table.recordedAt),
    check('audit_events_actor_ck', sql`${table.actorKind} in ('admin', 'system', 'operator')`),
    check(
      'audit_events_outcome_ck',
      sql`${table.outcome} in ('succeeded', 'denied', 'failed', 'requested')`,
    ),
  ],
)

export const auditEventTargets = appSchema.table(
  'audit_event_targets',
  {
    ...immutableRecordColumns(),
    auditEventId: uuid('audit_event_id')
      .notNull()
      .references(() => auditEvents.id),
    role: text('role').notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    targetVersion: bigint('target_version', { mode: 'bigint' }),
    displaySnapshot: text('display_snapshot'),
  },
  (table) => [
    index('audit_event_targets_lookup_idx').on(table.targetType, table.targetId),
    check('audit_event_targets_role_ck', sql`${table.role} in ('primary', 'related', 'affected')`),
  ],
)

export const auditEventChanges = appSchema.table(
  'audit_event_changes',
  {
    ...immutableRecordColumns(),
    auditEventId: uuid('audit_event_id')
      .notNull()
      .references(() => auditEvents.id),
    schemaVersion: integer('schema_version').notNull(),
    redactedDiff: jsonb('redacted_diff'),
    revisionType: text('revision_type'),
    revisionId: uuid('revision_id'),
  },
  (table) => [
    check(
      'audit_event_changes_source_ck',
      sql`(${table.redactedDiff} is not null) <> (${table.revisionId} is not null)`,
    ),
    check(
      'audit_event_changes_revision_ck',
      sql`${table.revisionId} is null or ${table.revisionType} is not null`,
    ),
    check('audit_event_changes_schema_ck', sql`${table.schemaVersion} > 0`),
  ],
)

export const securityEventContexts = appSchema.table(
  'security_event_contexts',
  {
    ...mutableRecordColumns(),
    auditEventId: uuid('audit_event_id')
      .notNull()
      .references(() => auditEvents.id),
    sessionHash: text('session_hash'),
    networkAddress: text('network_address'),
    clientDescription: text('client_description'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    unique('security_event_contexts_audit_uq').on(table.auditEventId),
    index('security_event_contexts_expiry_idx').on(table.expiresAt),
  ],
)

// Private Documents are separately access-controlled; public Media rows never reference these files.
export const privateDocuments = appSchema.table(
  'private_documents',
  {
    ...mutableRecordColumns(),
    ownerModule: text('owner_module').notNull(),
    ownerRecordId: uuid('owner_record_id').notNull(),
    accessClassification: text('access_classification').notNull(),
    currentVersionId: uuid('current_version_id').references(
      (): AnyPgColumn => privateDocumentVersions.id,
    ),
    retentionUntilAt: timestamp('retention_until_at', { withTimezone: true }),
    state: text('state').notNull().default('active'),
  },
  (table) => [
    index('private_documents_owner_idx').on(table.ownerModule, table.ownerRecordId),
    check('private_documents_state_ck', sql`${table.state} in ('active', 'restricted', 'deleted')`),
  ],
)

export const privateDocumentUploadIntents = appSchema.table(
  'private_document_upload_intents',
  {
    ...mutableRecordColumns(),
    ownerModule: text('owner_module').notNull(),
    ownerRecordId: uuid('owner_record_id').notNull(),
    uploaderId: uuid('uploader_id')
      .notNull()
      .references(() => adminIdentities.id),
    temporaryObjectKey: text('temporary_object_key').notNull(),
    expectedChecksum: text('expected_checksum').notNull(),
    expectedMimeType: text('expected_mime_type').notNull(),
    expectedSizeBytes: bigint('expected_size_bytes', { mode: 'bigint' }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    state: text('state').notNull().default('pending'),
  },
  (table) => [
    check('private_document_upload_intents_size_ck', sql`${table.expectedSizeBytes} > 0`),
    check(
      'private_document_upload_intents_state_ck',
      sql`${table.state} in ('pending', 'verified', 'expired', 'abandoned')`,
    ),
  ],
)

export const privateDocumentVersions = appSchema.table(
  'private_document_versions',
  {
    ...immutableRecordColumns(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => privateDocuments.id),
    objectKey: text('object_key').notNull(),
    checksum: text('checksum').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'bigint' }).notNull(),
    uploaderId: uuid('uploader_id')
      .notNull()
      .references(() => adminIdentities.id),
    uploadIntentId: uuid('upload_intent_id')
      .notNull()
      .references(() => privateDocumentUploadIntents.id),
    supersedesVersionId: uuid('supersedes_version_id').references(
      (): AnyPgColumn => privateDocumentVersions.id,
    ),
  },
  (table) => [
    unique('private_document_versions_key_uq').on(table.objectKey),
    unique('private_document_versions_intent_uq').on(table.uploadIntentId),
    check('private_document_versions_size_ck', sql`${table.sizeBytes} > 0`),
  ],
)

export const supportingReferences = appSchema.table(
  'supporting_references',
  {
    ...immutableRecordColumns(),
    referenceKind: text('reference_kind').notNull(),
    externalUrl: text('external_url'),
    privateDocumentVersionId: uuid('private_document_version_id').references(
      () => privateDocumentVersions.id,
    ),
    externalIdentifier: text('external_identifier'),
    textReference: text('text_reference'),
    label: text('label').notNull(),
    recordedById: uuid('recorded_by_id').references(() => adminIdentities.id),
  },
  (table) => [
    check(
      'supporting_references_kind_ck',
      sql`${table.referenceKind} in ('external_url', 'private_document', 'external_identifier', 'text')`,
    ),
    check(
      'supporting_references_one_source_ck',
      sql`num_nonnulls(${table.externalUrl}, ${table.privateDocumentVersionId}, ${table.externalIdentifier}, ${table.textReference}) = 1`,
    ),
    check(
      'supporting_references_typed_source_ck',
      sql`(${table.referenceKind} = 'external_url' and ${table.externalUrl} is not null) or (${table.referenceKind} = 'private_document' and ${table.privateDocumentVersionId} is not null) or (${table.referenceKind} = 'external_identifier' and ${table.externalIdentifier} is not null) or (${table.referenceKind} = 'text' and ${table.textReference} is not null)`,
    ),
  ],
)

export const privacyRequests = appSchema.table(
  'privacy_requests',
  {
    ...mutableRecordColumns(),
    requesterContact: text('requester_contact').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    acknowledgementDueAt: timestamp('acknowledgement_due_at', { withTimezone: true }).notNull(),
    resolutionDueAt: timestamp('resolution_due_at', { withTimezone: true }).notNull(),
    state: text('state').notNull().default('received'),
    outcomeReason: text('outcome_reason'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    index('privacy_requests_state_due_idx').on(table.state, table.resolutionDueAt),
    check(
      'privacy_requests_state_ck',
      sql`${table.state} in ('received', 'in_review', 'fulfilled', 'partially_fulfilled', 'rejected')`,
    ),
  ],
)

export const privacyRequestTransitions = appSchema.table('privacy_request_transitions', {
  ...immutableRecordColumns(),
  requestId: uuid('request_id')
    .notNull()
    .references(() => privacyRequests.id),
  fromState: text('from_state'),
  toState: text('to_state').notNull(),
  reason: text('reason').notNull(),
  actorId: uuid('actor_id')
    .notNull()
    .references(() => adminIdentities.id),
})

export const privacyRequestItems = appSchema.table(
  'privacy_request_items',
  {
    ...mutableRecordColumns(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => privacyRequests.id),
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    requestedScope: text('requested_scope').notNull(),
    description: text('description'),
  },
  (table) => [index('privacy_request_items_target_idx').on(table.subjectType, table.subjectId)],
)

export const privacyRequestActions = appSchema.table(
  'privacy_request_actions',
  {
    ...immutableRecordColumns(),
    requestItemId: uuid('request_item_id')
      .notNull()
      .references(() => privacyRequestItems.id),
    action: text('action').notNull(),
    decisionReason: text('decision_reason').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    evidenceReferenceId: uuid('evidence_reference_id').references(() => supportingReferences.id),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => adminIdentities.id),
  },
  (table) => [
    check(
      'privacy_request_actions_type_ck',
      sql`${table.action} in ('correct', 'restrict', 'anonymize', 'delete', 'preserve', 'purge')`,
    ),
  ],
)

export const legalHolds = appSchema.table(
  'legal_holds',
  {
    ...mutableRecordColumns(),
    reason: text('reason').notNull(),
    state: text('state').notNull().default('active'),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => adminIdentities.id),
    releasedById: uuid('released_by_id').references(() => adminIdentities.id),
    releasedAt: timestamp('released_at', { withTimezone: true }),
  },
  (table) => [check('legal_holds_state_ck', sql`${table.state} in ('active', 'released')`)],
)

export const legalHoldTargets = appSchema.table(
  'legal_hold_targets',
  {
    ...immutableRecordColumns(),
    holdId: uuid('hold_id')
      .notNull()
      .references(() => legalHolds.id),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    scope: text('scope').notNull(),
  },
  (table) => [
    unique('legal_hold_targets_scope_uq').on(table.holdId, table.targetType, table.targetId),
    index('legal_hold_targets_lookup_idx').on(table.targetType, table.targetId),
    check('legal_hold_targets_scope_ck', sql`${table.scope} in ('direct', 'enclosing')`),
  ],
)

export const retentionPolicies = appSchema.table(
  'retention_policies',
  {
    ...immutableRecordColumns(),
    resourceType: text('resource_type').notNull(),
    trigger: text('trigger').notNull(),
    durationDays: integer('duration_days').notNull(),
    action: text('action').notNull(),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
    approvedById: uuid('approved_by_id')
      .notNull()
      .references(() => adminIdentities.id),
    supersedesPolicyId: uuid('supersedes_policy_id').references(
      (): AnyPgColumn => retentionPolicies.id,
    ),
  },
  (table) => [check('retention_policies_duration_ck', sql`${table.durationDays} >= 0`)],
)

export const retentionCandidates = appSchema.table(
  'retention_candidates',
  {
    ...mutableRecordColumns(),
    policyId: uuid('policy_id')
      .notNull()
      .references(() => retentionPolicies.id),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    holdCheckState: text('hold_check_state').notNull().default('pending'),
    referenceCheckState: text('reference_check_state').notNull().default('pending'),
    reviewState: text('review_state').notNull().default('pending'),
    executionResult: text('execution_result'),
  },
  (table) => [
    unique('retention_candidates_policy_target_uq').on(
      table.policyId,
      table.targetType,
      table.targetId,
    ),
    index('retention_candidates_due_idx').on(table.reviewState, table.dueAt),
  ],
)

export const privacyDeletionLedger = appSchema.table(
  'privacy_deletion_ledger',
  {
    ...immutableRecordColumns(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => privacyRequests.id),
    opaqueTargetHash: text('opaque_target_hash').notNull(),
    hashKeyVersion: integer('hash_key_version').notNull(),
    action: text('action').notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull(),
    reappliesLedgerId: uuid('reapplies_ledger_id').references(
      (): AnyPgColumn => privacyDeletionLedger.id,
    ),
  },
  (table) => [
    index('privacy_deletion_ledger_target_idx').on(table.opaqueTargetHash),
    check('privacy_deletion_ledger_key_version_ck', sql`${table.hashKeyVersion} > 0`),
  ],
)
