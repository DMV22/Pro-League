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
} from 'drizzle-orm/pg-core'

import { adminIdentities } from '../../identity-access/infrastructure/schema'
import { immutableRecordColumns, mutableRecordColumns } from '../../../server/db/columns'
import { appSchema } from '../../../server/db/schema'

// Queue payloads contain typed IDs and versions, never raw personal records or credentials.
export const outboxMessages = appSchema.table(
  'outbox_messages',
  {
    ...mutableRecordColumns(),
    messageType: text('message_type').notNull(),
    schemaVersion: integer('schema_version').notNull(),
    payload: jsonb('payload').notNull(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    aggregateVersion: bigint('aggregate_version', { mode: 'bigint' }).notNull(),
    correlationKey: text('correlation_key'),
    causationKey: text('causation_key'),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull(),
    leaseUntilAt: timestamp('lease_until_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').notNull().default(0),
    state: text('state').notNull().default('pending'),
    sanitizedOutcome: text('sanitized_outcome'),
  },
  (table) => [
    index('outbox_messages_claim_idx').on(table.state, table.availableAt),
    check('outbox_messages_schema_ck', sql`${table.schemaVersion} > 0`),
    check('outbox_messages_attempts_ck', sql`${table.attemptCount} >= 0`),
    check(
      'outbox_messages_state_ck',
      sql`${table.state} in ('pending', 'leased', 'succeeded', 'failed', 'exhausted')`,
    ),
  ],
)

export const commandExecutions = appSchema.table(
  'command_executions',
  {
    ...mutableRecordColumns(),
    actorScope: text('actor_scope').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    payloadHash: text('payload_hash').notNull(),
    resultType: text('result_type'),
    resultId: uuid('result_id'),
    state: text('state').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    unique('command_executions_scope_key_uq').on(table.actorScope, table.idempotencyKey),
    check('command_executions_state_ck', sql`${table.state} in ('pending', 'succeeded', 'failed')`),
  ],
)

export const scheduledJobs = appSchema.table(
  'scheduled_jobs',
  {
    ...mutableRecordColumns(),
    logicalJobKey: text('logical_job_key').notNull(),
    jobType: text('job_type').notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    targetVersion: bigint('target_version', { mode: 'bigint' }),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    leaseUntilAt: timestamp('lease_until_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').notNull().default(0),
    state: text('state').notNull().default('pending'),
  },
  (table) => [
    unique('scheduled_jobs_logical_key_uq').on(table.logicalJobKey),
    index('scheduled_jobs_claim_idx').on(table.state, table.dueAt),
    check('scheduled_jobs_attempts_ck', sql`${table.attemptCount} >= 0`),
    check(
      'scheduled_jobs_state_ck',
      sql`${table.state} in ('pending', 'leased', 'succeeded', 'failed', 'cancelled')`,
    ),
  ],
)

export const jobRuns = appSchema.table(
  'job_runs',
  {
    ...immutableRecordColumns(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => scheduledJobs.id),
    attemptNumber: integer('attempt_number').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    outcome: text('outcome').notNull(),
    sanitizedError: text('sanitized_error'),
  },
  (table) => [
    unique('job_runs_attempt_uq').on(table.jobId, table.attemptNumber),
    check('job_runs_attempt_ck', sql`${table.attemptNumber} > 0`),
  ],
)

export const cacheInvalidationIntents = appSchema.table(
  'cache_invalidation_intents',
  {
    ...mutableRecordColumns(),
    semanticTarget: text('semantic_target').notNull(),
    committedVersion: bigint('committed_version', { mode: 'bigint' }).notNull(),
    urgency: text('urgency').notNull().default('ordinary'),
    state: text('state').notNull().default('pending'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (table) => [
    unique('cache_invalidation_intents_target_version_uq').on(
      table.semanticTarget,
      table.committedVersion,
    ),
    check('cache_invalidation_intents_urgency_ck', sql`${table.urgency} in ('ordinary', 'urgent')`),
    check(
      'cache_invalidation_intents_state_ck',
      sql`${table.state} in ('pending', 'confirmed', 'failed')`,
    ),
  ],
)

export const inboundWebhookReceipts = appSchema.table(
  'inbound_webhook_receipts',
  {
    ...mutableRecordColumns(),
    source: text('source').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    signatureResult: text('signature_result').notNull(),
    payloadHash: text('payload_hash').notNull(),
    sanitizedPayload: jsonb('sanitized_payload'),
    processingState: text('processing_state').notNull().default('pending'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => [
    unique('inbound_webhook_receipts_source_event_uq').on(table.source, table.providerEventId),
    check(
      'inbound_webhook_receipts_signature_ck',
      sql`${table.signatureResult} in ('verified', 'rejected')`,
    ),
    check(
      'inbound_webhook_receipts_state_ck',
      sql`${table.processingState} in ('pending', 'processed', 'ignored', 'failed')`,
    ),
  ],
)

export const notificationDeliveries = appSchema.table(
  'notification_deliveries',
  {
    ...mutableRecordColumns(),
    template: text('template').notNull(),
    templateVersion: integer('template_version').notNull(),
    recipientClass: text('recipient_class').notNull(),
    recipientAddress: text('recipient_address'),
    deterministicKey: text('deterministic_key').notNull(),
    state: text('state').notNull().default('pending'),
    providerReference: text('provider_reference'),
    sanitizedOutcome: text('sanitized_outcome'),
  },
  (table) => [
    unique('notification_deliveries_key_uq').on(table.deterministicKey),
    check('notification_deliveries_template_version_ck', sql`${table.templateVersion} > 0`),
    check(
      'notification_deliveries_state_ck',
      sql`${table.state} in ('pending', 'sent', 'failed', 'suppressed')`,
    ),
  ],
)

export const incidentRecords = appSchema.table(
  'incident_records',
  {
    ...mutableRecordColumns(),
    severity: text('severity').notNull(),
    state: text('state').notNull().default('open'),
    ownerSnapshot: text('owner_snapshot').notNull(),
    impactSummary: text('impact_summary').notNull(),
    affectedClassification: text('affected_classification').notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    postmortemReference: text('postmortem_reference'),
  },
  (table) => [
    index('incident_records_state_idx').on(table.state, table.severity),
    check('incident_records_severity_ck', sql`${table.severity} in ('sev1', 'sev2', 'sev3')`),
    check(
      'incident_records_state_ck',
      sql`${table.state} in ('open', 'mitigating', 'resolved', 'closed')`,
    ),
  ],
)

export const incidentStateTransitions = appSchema.table('incident_state_transitions', {
  ...immutableRecordColumns(),
  incidentId: uuid('incident_id')
    .notNull()
    .references(() => incidentRecords.id),
  fromState: text('from_state'),
  toState: text('to_state').notNull(),
  actorSnapshot: text('actor_snapshot').notNull(),
  reason: text('reason').notNull(),
})

export const operationalAlerts = appSchema.table(
  'operational_alerts',
  {
    ...mutableRecordColumns(),
    severity: text('severity').notNull(),
    source: text('source').notNull(),
    message: text('message').notNull(),
    state: text('state').notNull().default('open'),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    incidentId: uuid('incident_id').references(() => incidentRecords.id),
  },
  (table) => [
    index('operational_alerts_state_idx').on(table.state, table.severity),
    check(
      'operational_alerts_state_ck',
      sql`${table.state} in ('open', 'acknowledged', 'resolved')`,
    ),
  ],
)

export const recoveryVerifications = appSchema.table(
  'recovery_verifications',
  {
    ...immutableRecordColumns(),
    backupReference: text('backup_reference').notNull(),
    recoveryPointAt: timestamp('recovery_point_at', { withTimezone: true }).notNull(),
    elapsedSeconds: integer('elapsed_seconds').notNull(),
    integrityChecks: jsonb('integrity_checks').notNull(),
    operatorSnapshot: text('operator_snapshot').notNull(),
    outcome: text('outcome').notNull(),
  },
  (table) => [check('recovery_verifications_elapsed_ck', sql`${table.elapsedSeconds} >= 0`)],
)

export const restoreValidations = appSchema.table(
  'restore_validations',
  {
    ...immutableRecordColumns(),
    recoveryVerificationId: uuid('recovery_verification_id')
      .notNull()
      .references(() => recoveryVerifications.id),
    adminIdentityId: uuid('admin_identity_id')
      .notNull()
      .references(() => adminIdentities.id),
    resultsValid: text('results_valid').notNull(),
    standingsValid: text('standings_valid').notNull(),
    applicationsValid: text('applications_valid').notNull(),
    publicationsValid: text('publications_valid').notNull(),
    cacheValid: text('cache_valid').notNull(),
    reason: text('reason'),
    outcome: text('outcome').notNull(),
  },
  (table) => [
    unique('restore_validations_recovery_admin_uq').on(
      table.recoveryVerificationId,
      table.adminIdentityId,
    ),
  ],
)
