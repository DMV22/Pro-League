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
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { immutableRecordColumns, mutableRecordColumns } from '../../../server/db/columns'
import { appSchema } from '../../../server/db/schema'

// Clerk authenticates; only a local active grant authorizes Admin operations.
export const adminIdentities = appSchema.table(
  'admin_identities',
  {
    ...mutableRecordColumns(),
    displayName: text('display_name').notNull(),
    contactEmail: text('contact_email').notNull(),
    normalizedEmail: text('normalized_email').notNull(),
    lifecycleState: text('lifecycle_state').notNull().default('active'),
  },
  (table) => [
    index('admin_identities_email_idx').on(table.normalizedEmail),
    check('admin_identities_state_ck', sql`${table.lifecycleState} in ('active', 'retired')`),
  ],
)

export const adminExternalIdentities = appSchema.table(
  'admin_external_identities',
  {
    ...mutableRecordColumns(),
    adminIdentityId: uuid('admin_identity_id')
      .notNull()
      .references(() => adminIdentities.id),
    provider: text('provider').notNull().default('clerk'),
    providerUserId: text('provider_user_id').notNull(),
    lastSynchronizedAt: timestamp('last_synchronized_at', { withTimezone: true }).notNull(),
    providerUpdatedAt: timestamp('provider_updated_at', { withTimezone: true }),
  },
  (table) => [
    unique('admin_external_identities_provider_user_uq').on(table.provider, table.providerUserId),
    unique('admin_external_identities_admin_provider_uq').on(table.adminIdentityId, table.provider),
  ],
)

export const adminInvitations = appSchema.table(
  'admin_invitations',
  {
    ...mutableRecordColumns(),
    normalizedEmail: text('normalized_email').notNull(),
    providerInvitationId: text('provider_invitation_id'),
    inviterAdminIdentityId: uuid('inviter_admin_identity_id').references(() => adminIdentities.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    state: text('state').notNull().default('pending'),
    resendCount: integer('resend_count').notNull().default(0),
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('admin_invitations_provider_id_uq').on(table.providerInvitationId),
    uniqueIndex('admin_invitations_pending_email_uq')
      .on(table.normalizedEmail)
      .where(sql`${table.state} = 'pending'`),
    check(
      'admin_invitations_state_ck',
      sql`${table.state} in ('pending', 'accepted', 'expired', 'revoked')`,
    ),
    check('admin_invitations_resend_ck', sql`${table.resendCount} >= 0`),
  ],
)

export const adminAccessGrants = appSchema.table(
  'admin_access_grants',
  {
    ...mutableRecordColumns(),
    adminIdentityId: uuid('admin_identity_id')
      .notNull()
      .references(() => adminIdentities.id),
    sourceInvitationId: uuid('source_invitation_id').references(() => adminInvitations.id),
    source: text('source').notNull(),
    state: text('state').notNull().default('invited'),
    effectiveAt: timestamp('effective_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('admin_access_grants_current_uq')
      .on(table.adminIdentityId)
      .where(sql`${table.state} in ('invited', 'active', 'suspended')`),
    check('admin_access_grants_source_ck', sql`${table.source} in ('invitation', 'bootstrap')`),
    check(
      'admin_access_grants_source_invitation_ck',
      sql`(${table.source} = 'bootstrap' and ${table.sourceInvitationId} is null) or (${table.source} = 'invitation' and ${table.sourceInvitationId} is not null)`,
    ),
    check(
      'admin_access_grants_state_ck',
      sql`${table.state} in ('invited', 'active', 'suspended', 'revoked')`,
    ),
    check(
      'admin_access_grants_period_ck',
      sql`${table.endedAt} is null or (${table.effectiveAt} is not null and ${table.endedAt} >= ${table.effectiveAt})`,
    ),
  ],
)

export const adminAccessStateTransitions = appSchema.table(
  'admin_access_state_transitions',
  {
    ...immutableRecordColumns(),
    grantId: uuid('grant_id')
      .notNull()
      .references(() => adminAccessGrants.id),
    fromState: text('from_state'),
    toState: text('to_state').notNull(),
    reason: text('reason'),
    actorId: uuid('actor_id'),
    externalSyncState: text('external_sync_state').notNull().default('not_required'),
  },
  (table) => [
    check(
      'admin_access_state_transitions_to_ck',
      sql`${table.toState} in ('invited', 'active', 'suspended', 'revoked')`,
    ),
    check(
      'admin_access_state_transitions_sync_ck',
      sql`${table.externalSyncState} in ('not_required', 'pending', 'succeeded', 'failed')`,
    ),
  ],
)

export const adminSessions = appSchema.table(
  'admin_sessions',
  {
    ...mutableRecordColumns(),
    grantId: uuid('grant_id')
      .notNull()
      .references(() => adminAccessGrants.id),
    providerSessionHash: text('provider_session_hash').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    providerExpiresAt: timestamp('provider_expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [unique('admin_sessions_hash_uq').on(table.providerSessionHash)],
)

export const externalIdentityEvents = appSchema.table(
  'external_identity_events',
  {
    ...mutableRecordColumns(),
    source: text('source').notNull().default('clerk'),
    providerEventId: text('provider_event_id').notNull(),
    providerSubjectId: text('provider_subject_id').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    sanitizedFields: jsonb('sanitized_fields').notNull(),
    processingState: text('processing_state').notNull().default('pending'),
    outcome: text('outcome'),
  },
  (table) => [
    unique('external_identity_events_source_event_uq').on(table.source, table.providerEventId),
    check(
      'external_identity_events_state_ck',
      sql`${table.processingState} in ('pending', 'processed', 'ignored', 'reconciliation_required', 'failed')`,
    ),
  ],
)

export const externalSyncOperations = appSchema.table(
  'external_sync_operations',
  {
    ...mutableRecordColumns(),
    adminIdentityId: uuid('admin_identity_id')
      .notNull()
      .references(() => adminIdentities.id),
    requestedLocalVersion: bigint('requested_local_version', { mode: 'bigint' }).notNull(),
    operationType: text('operation_type').notNull(),
    deterministicKey: text('deterministic_key').notNull(),
    providerReference: text('provider_reference'),
    attemptCount: integer('attempt_count').notNull().default(0),
    state: text('state').notNull().default('pending'),
    sanitizedOutcome: text('sanitized_outcome'),
  },
  (table) => [
    unique('external_sync_operations_key_uq').on(table.deterministicKey),
    check('external_sync_operations_attempt_ck', sql`${table.attemptCount} >= 0`),
    check(
      'external_sync_operations_state_ck',
      sql`${table.state} in ('pending', 'running', 'succeeded', 'failed', 'reconciliation_required')`,
    ),
  ],
)

export const reconciliationItems = appSchema.table(
  'reconciliation_items',
  {
    ...mutableRecordColumns(),
    sourceEventId: uuid('source_event_id').references(() => externalIdentityEvents.id),
    affectedRecordType: text('affected_record_type').notNull(),
    affectedRecordId: uuid('affected_record_id'),
    explanation: text('explanation').notNull(),
    state: text('state').notNull().default('open'),
    resolvedById: uuid('resolved_by_id').references(() => adminIdentities.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'reconciliation_items_state_ck',
      sql`${table.state} in ('open', 'resolved', 'dismissed')`,
    ),
  ],
)

export const privilegedOperationRecords = appSchema.table(
  'privileged_operation_records',
  {
    ...immutableRecordColumns(),
    operation: text('operation').notNull(),
    operatorSnapshot: text('operator_snapshot').notNull(),
    reason: text('reason').notNull(),
    evidenceReferenceId: uuid('evidence_reference_id'), // Governance FK in #72.
    outcome: text('outcome').notNull(),
    reconciliationState: text('reconciliation_state').notNull().default('not_required'),
  },
  (table) => [
    check(
      'privileged_operation_records_operation_ck',
      sql`${table.operation} in ('bootstrap', 'break_glass')`,
    ),
    check(
      'privileged_operation_records_outcome_ck',
      sql`${table.outcome} in ('succeeded', 'denied', 'failed')`,
    ),
  ],
)
