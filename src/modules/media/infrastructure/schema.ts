import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

import { immutableRecordColumns, mutableRecordColumns } from '../../../server/db/columns'
import { appSchema } from '../../../server/db/schema'

// Binary objects remain in object storage. Only verified keys and metadata are persisted here.
export const mediaUploadIntents = appSchema.table(
  'media_upload_intents',
  {
    ...mutableRecordColumns(),
    uploaderId: uuid('uploader_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    temporaryObjectKey: text('temporary_object_key').notNull(),
    expectedMimeType: text('expected_mime_type').notNull(),
    expectedSizeBytes: integer('expected_size_bytes').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    state: text('state').notNull().default('pending'),
  },
  (table) => [
    unique('media_upload_intents_idempotency_uq').on(table.uploaderId, table.idempotencyKey),
    check(
      'media_upload_intents_size_ck',
      sql`${table.expectedSizeBytes} > 0 and ${table.expectedSizeBytes} <= 10485760`,
    ),
    check(
      'media_upload_intents_state_ck',
      sql`${table.state} in ('pending', 'verified', 'expired', 'abandoned')`,
    ),
  ],
)

export const mediaAssets = appSchema.table(
  'media_assets',
  {
    ...mutableRecordColumns(),
    uploadIntentId: uuid('upload_intent_id')
      .notNull()
      .references(() => mediaUploadIntents.id),
    originalFilename: text('original_filename').notNull(),
    originalObjectKey: text('original_object_key').notNull(),
    originalChecksum: text('original_checksum').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    state: text('state').notNull().default('processing'),
    uploadedById: uuid('uploaded_by_id').notNull(),
    currentMetadataVersionId: uuid('current_metadata_version_id').references(
      (): AnyPgColumn => mediaAssetMetadataVersions.id,
    ),
    currentPresentationId: uuid('current_presentation_id').references(
      (): AnyPgColumn => mediaPresentations.id,
    ),
  },
  (table) => [
    unique('media_assets_upload_intent_uq').on(table.uploadIntentId),
    unique('media_assets_original_key_uq').on(table.originalObjectKey),
    index('media_assets_state_idx').on(table.state),
    check('media_assets_size_ck', sql`${table.sizeBytes} > 0 and ${table.sizeBytes} <= 10485760`),
    check('media_assets_dimensions_ck', sql`${table.width} > 0 and ${table.height} > 0`),
    check(
      'media_assets_type_ck',
      sql`${table.mimeType} in ('image/jpeg', 'image/png', 'image/webp')`,
    ),
    check(
      'media_assets_state_ck',
      sql`${table.state} in ('processing', 'active', 'failed', 'withdrawn')`,
    ),
  ],
)

export const mediaAssetMetadataVersions = appSchema.table('media_asset_metadata_versions', {
  ...immutableRecordColumns(),
  mediaAssetId: uuid('media_asset_id')
    .notNull()
    .references(() => mediaAssets.id),
  source: text('source').notNull(),
  creator: text('creator'),
  rightsStatement: text('rights_statement').notNull(),
  defaultAltText: text('default_alt_text'),
  defaultCaption: text('default_caption'),
  correctionReason: text('correction_reason'),
  authorId: uuid('author_id').notNull(),
  supersedesVersionId: uuid('supersedes_version_id').references(
    (): AnyPgColumn => mediaAssetMetadataVersions.id,
  ),
})

export const mediaPresentations = appSchema.table(
  'media_presentations',
  {
    ...immutableRecordColumns(),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id),
    focalX: integer('focal_x').notNull().default(50),
    focalY: integer('focal_y').notNull().default(50),
    transformationVersion: text('transformation_version').notNull(),
    readiness: text('readiness').notNull().default('pending'),
    supersedesPresentationId: uuid('supersedes_presentation_id').references(
      (): AnyPgColumn => mediaPresentations.id,
    ),
  },
  (table) => [
    check(
      'media_presentations_focal_ck',
      sql`${table.focalX} between 0 and 100 and ${table.focalY} between 0 and 100`,
    ),
    check(
      'media_presentations_readiness_ck',
      sql`${table.readiness} in ('pending', 'ready', 'failed')`,
    ),
  ],
)

export const mediaAssetVariants = appSchema.table(
  'media_asset_variants',
  {
    ...immutableRecordColumns(),
    presentationId: uuid('presentation_id')
      .notNull()
      .references(() => mediaPresentations.id),
    purpose: text('purpose').notNull(),
    format: text('format').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    objectKey: text('object_key').notNull(),
    checksum: text('checksum').notNull(),
    processingState: text('processing_state').notNull(),
  },
  (table) => [
    unique('media_asset_variants_purpose_uq').on(
      table.presentationId,
      table.purpose,
      table.format,
      table.width,
    ),
    unique('media_asset_variants_key_uq').on(table.objectKey),
    check('media_asset_variants_dimensions_ck', sql`${table.width} > 0 and ${table.height} > 0`),
    check(
      'media_asset_variants_state_ck',
      sql`${table.processingState} in ('pending', 'ready', 'failed')`,
    ),
  ],
)

export const mediaProcessingAttempts = appSchema.table(
  'media_processing_attempts',
  {
    ...mutableRecordColumns(),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id),
    presentationId: uuid('presentation_id').references(() => mediaPresentations.id),
    processorVersion: text('processor_version').notNull(),
    attemptNumber: integer('attempt_number').notNull(),
    state: text('state').notNull(),
    sanitizedError: text('sanitized_error'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    unique('media_processing_attempts_number_uq').on(
      table.mediaAssetId,
      table.processorVersion,
      table.attemptNumber,
    ),
    check('media_processing_attempts_number_ck', sql`${table.attemptNumber} > 0`),
    check(
      'media_processing_attempts_state_ck',
      sql`${table.state} in ('pending', 'running', 'succeeded', 'failed')`,
    ),
  ],
)

export const mediaAssetStateTransitions = appSchema.table('media_asset_state_transitions', {
  ...immutableRecordColumns(),
  mediaAssetId: uuid('media_asset_id')
    .notNull()
    .references(() => mediaAssets.id),
  fromState: text('from_state').notNull(),
  toState: text('to_state').notNull(),
  reason: text('reason'),
  actorId: uuid('actor_id'),
  processingAttemptId: uuid('processing_attempt_id').references(() => mediaProcessingAttempts.id),
})

export const mediaWithdrawalDecisions = appSchema.table(
  'media_withdrawal_decisions',
  {
    ...immutableRecordColumns(),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id),
    decision: text('decision').notNull(),
    reason: text('reason').notNull(),
    supportingReferenceId: uuid('supporting_reference_id'), // Governance FK finalized in #72.
    actorId: uuid('actor_id').notNull(),
    urgentPurgeState: text('urgent_purge_state').notNull().default('not_required'),
    supersedesDecisionId: uuid('supersedes_decision_id').references(
      (): AnyPgColumn => mediaWithdrawalDecisions.id,
    ),
  },
  (table) => [
    check('media_withdrawal_decisions_type_ck', sql`${table.decision} in ('withdraw', 'restore')`),
    check(
      'media_withdrawal_decisions_purge_ck',
      sql`${table.urgentPurgeState} in ('not_required', 'pending', 'completed', 'failed')`,
    ),
  ],
)

export const mediaStorageTombstones = appSchema.table(
  'media_storage_tombstones',
  {
    ...immutableRecordColumns(),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id),
    variantId: uuid('variant_id').references(() => mediaAssetVariants.id),
    objectKeyHash: text('object_key_hash').notNull(),
    checksum: text('checksum').notNull(),
    reason: text('reason').notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull(),
    restoreReconciliationState: text('restore_reconciliation_state')
      .notNull()
      .default('not_required'),
  },
  (table) => [uniqueIndex('media_storage_tombstones_key_hash_uq').on(table.objectKeyHash)],
)
