import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

import { seasons } from '../../competition/infrastructure/schema'
import { immutableRecordColumns, mutableRecordColumns } from '../../../server/db/columns'
import { appSchema } from '../../../server/db/schema'

// PostgreSQL's daterange and GiST exclusion are reviewed in the #72 SQL migration.
const dateRange = customType<{ data: string }>({ dataType: () => 'daterange' })

export const teams = appSchema.table(
  'teams',
  {
    ...mutableRecordColumns(),
    displayName: text('display_name').notNull(),
    locality: text('locality'),
    visibility: text('visibility').notNull().default('private'),
    archiveState: text('archive_state').notNull().default('active'),
    currentProfileVersionId: uuid('current_profile_version_id').references(
      (): AnyPgColumn => teamProfileVersions.id,
    ),
    currentSlugId: uuid('current_slug_id').references((): AnyPgColumn => teamSlugs.id),
  },
  (table) => [
    check('teams_visibility_ck', sql`${table.visibility} in ('private', 'public')`),
    check('teams_archive_state_ck', sql`${table.archiveState} in ('active', 'archived')`),
  ],
)

export const teamProfileVersions = appSchema.table(
  'team_profile_versions',
  {
    ...immutableRecordColumns(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id),
    officialName: text('official_name').notNull(),
    shortName: text('short_name'),
    locality: text('locality'),
    logoMediaAssetId: uuid('logo_media_asset_id'), // Media FK in #71/#72.
    correctionReason: text('correction_reason'),
    authorId: uuid('author_id').notNull(),
  },
  (table) => [unique('team_profile_versions_owner_id_uq').on(table.teamId, table.id)],
)

export const teamSlugs = appSchema.table(
  'team_slugs',
  {
    ...immutableRecordColumns(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id),
    displaySlug: text('display_slug').notNull(),
    normalizedSlug: text('normalized_slug').notNull(),
    validFromAt: timestamp('valid_from_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('team_slugs_normalized_uq').on(table.normalizedSlug),
    unique('team_slugs_owner_id_uq').on(table.teamId, table.id),
    index('team_slugs_owner_idx').on(table.teamId),
  ],
)

export const players = appSchema.table(
  'players',
  {
    ...mutableRecordColumns(),
    currentIdentityVersionId: uuid('current_identity_version_id').references(
      (): AnyPgColumn => playerIdentityVersions.id,
    ),
    publicProfileState: text('public_profile_state').notNull().default('restricted'),
    currentPhotoMediaAssetId: uuid('current_photo_media_asset_id'), // Media FK in #71/#72.
    mergedIntoPlayerId: uuid('merged_into_player_id').references((): AnyPgColumn => players.id),
  },
  (table) => [
    check(
      'players_public_profile_state_ck',
      sql`${table.publicProfileState} in ('restricted', 'minimal', 'full')`,
    ),
    check(
      'players_no_self_merge_ck',
      sql`${table.mergedIntoPlayerId} is null or ${table.mergedIntoPlayerId} <> ${table.id}`,
    ),
  ],
)

export const playerIdentityVersions = appSchema.table(
  'player_identity_versions',
  {
    ...immutableRecordColumns(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),
    givenName: text('given_name').notNull(),
    familyName: text('family_name').notNull(),
    patronymic: text('patronymic'),
    displayName: text('display_name').notNull(),
    normalizedSearchName: text('normalized_search_name').notNull(),
    correctionReason: text('correction_reason'),
    authorId: uuid('author_id').notNull(),
  },
  (table) => [
    unique('player_identity_versions_owner_id_uq').on(table.playerId, table.id),
    index('player_identity_versions_search_idx').on(table.normalizedSearchName),
  ],
)

export const playerPrivateDetails = appSchema.table(
  'player_private_details',
  {
    ...mutableRecordColumns(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),
    currentVersionId: uuid('current_version_id').references(
      (): AnyPgColumn => playerPrivateDetailVersions.id,
    ),
  },
  (table) => [unique('player_private_details_player_uq').on(table.playerId)],
)

export const playerPrivateDetailVersions = appSchema.table(
  'player_private_detail_versions',
  {
    ...immutableRecordColumns(),
    privateDetailsId: uuid('private_details_id')
      .notNull()
      .references(() => playerPrivateDetails.id),
    dateOfBirth: date('date_of_birth', { mode: 'string' }).notNull(),
    federationIdentifier: text('federation_identifier'),
    correctionReason: text('correction_reason'),
    authorId: uuid('author_id').notNull(),
    supersedesVersionId: uuid('supersedes_version_id').references(
      (): AnyPgColumn => playerPrivateDetailVersions.id,
    ),
  },
  (table) => [
    unique('player_private_detail_versions_owner_id_uq').on(table.privateDetailsId, table.id),
  ],
)

export const playerMerges = appSchema.table(
  'player_merges',
  {
    ...immutableRecordColumns(),
    retainedPlayerId: uuid('retained_player_id')
      .notNull()
      .references(() => players.id),
    retiredPlayerId: uuid('retired_player_id')
      .notNull()
      .references(() => players.id),
    reason: text('reason').notNull(),
    actorId: uuid('actor_id').notNull(),
  },
  (table) => [
    unique('player_merges_retired_uq').on(table.retiredPlayerId),
    check(
      'player_merges_distinct_players_ck',
      sql`${table.retainedPlayerId} <> ${table.retiredPlayerId}`,
    ),
  ],
)

export const playerPublicationTransitions = appSchema.table(
  'player_publication_transitions',
  {
    ...immutableRecordColumns(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),
    fromState: text('from_state').notNull(),
    toState: text('to_state').notNull(),
    reason: text('reason').notNull(),
    actorId: uuid('actor_id').notNull(),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    check(
      'player_publication_transitions_state_ck',
      sql`${table.toState} in ('restricted', 'minimal', 'full')`,
    ),
  ],
)

export const playerPublicationConsents = appSchema.table('player_publication_consents', {
  ...mutableRecordColumns(),
  playerId: uuid('player_id')
    .notNull()
    .references(() => players.id),
  lawfulBasis: text('lawful_basis').notNull(),
  representativeName: text('representative_name'),
  scope: text('scope').notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  supportingReferenceId: uuid('supporting_reference_id'), // Governance FK in #71/#72.
  recordedByActorId: uuid('recorded_by_actor_id').notNull(),
})

export const seasonApplications = appSchema.table(
  'season_applications',
  {
    ...mutableRecordColumns(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'restrict' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id),
    submittedOn: date('submitted_on', { mode: 'string' }),
    state: text('state').notNull().default('recorded'),
    currentDecisionId: uuid('current_decision_id').references(
      (): AnyPgColumn => seasonApplicationDecisions.id,
    ),
    checklistTemplateId: uuid('checklist_template_id').references(
      (): AnyPgColumn => applicationChecklistTemplates.id,
    ),
  },
  (table) => [
    index('season_applications_season_state_idx').on(table.seasonId, table.state),
    index('season_applications_team_idx').on(table.teamId),
    check(
      'season_applications_state_ck',
      sql`${table.state} in ('recorded', 'under_review', 'approved', 'rejected', 'withdrawn')`,
    ),
  ],
)

export const seasonApplicationDecisions = appSchema.table(
  'season_application_decisions',
  {
    ...immutableRecordColumns(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => seasonApplications.id),
    action: text('action').notNull(),
    reason: text('reason').notNull(),
    actorId: uuid('actor_id').notNull(),
    supportingReferenceId: uuid('supporting_reference_id'), // Governance FK in #71/#72.
  },
  (table) => [
    check(
      'season_application_decisions_action_ck',
      sql`${table.action} in ('record', 'review', 'approve', 'reject', 'withdraw', 'supersede')`,
    ),
  ],
)

export const applicationChecklistTemplates = appSchema.table(
  'application_checklist_templates',
  {
    ...immutableRecordColumns(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'restrict' }),
    versionNumber: integer('version_number').notNull(),
    name: text('name').notNull(),
    itemDefinitionHash: text('item_definition_hash').notNull(),
    authorId: uuid('author_id').notNull(),
  },
  (table) => [
    unique('application_checklist_templates_version_uq').on(table.seasonId, table.versionNumber),
  ],
)

export const applicationChecklistTemplateItems = appSchema.table(
  'application_checklist_template_items',
  {
    ...immutableRecordColumns(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => applicationChecklistTemplates.id),
    position: integer('position').notNull(),
    label: text('label').notNull(),
    required: boolean('required').notNull(),
  },
  (table) => [
    unique('application_checklist_template_items_position_uq').on(table.templateId, table.position),
  ],
)

export const applicationChecklistItems = appSchema.table(
  'application_checklist_items',
  {
    ...immutableRecordColumns(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => seasonApplications.id),
    templateId: uuid('template_id')
      .notNull()
      .references(() => applicationChecklistTemplates.id),
    position: integer('position').notNull(),
    label: text('label').notNull(),
    required: boolean('required').notNull(),
    reviewOutcome: text('review_outcome').notNull(),
    reviewerId: uuid('reviewer_id'),
    exceptionReferenceId: uuid('exception_reference_id'), // Governance FK in #71/#72.
  },
  (table) => [
    unique('application_checklist_items_position_uq').on(table.applicationId, table.position),
  ],
)

export const seasonEntries = appSchema.table(
  'season_entries',
  {
    ...mutableRecordColumns(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'restrict' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id),
    approvedApplicationId: uuid('approved_application_id')
      .notNull()
      .references(() => seasonApplications.id),
    participationState: text('participation_state').notNull().default('registered'),
  },
  (table) => [
    unique('season_entries_team_season_uq').on(table.seasonId, table.teamId),
    unique('season_entries_application_uq').on(table.approvedApplicationId),
    unique('season_entries_season_id_uq').on(table.seasonId, table.id),
    index('season_entries_team_idx').on(table.teamId),
    check(
      'season_entries_state_ck',
      sql`${table.participationState} in ('registered', 'suspended', 'withdrawn', 'disqualified')`,
    ),
  ],
)

export const seasonEntryStateTransitions = appSchema.table('season_entry_state_transitions', {
  ...immutableRecordColumns(),
  seasonEntryId: uuid('season_entry_id')
    .notNull()
    .references(() => seasonEntries.id),
  fromState: text('from_state').notNull(),
  toState: text('to_state').notNull(),
  reason: text('reason').notNull(),
  actorId: uuid('actor_id').notNull(),
})

export const registrationWindows = appSchema.table(
  'registration_windows',
  {
    ...mutableRecordColumns(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'restrict' }),
    windowType: text('window_type').notNull(),
    startsOn: date('starts_on', { mode: 'string' }).notNull(),
    startsAtLocal: time('starts_at_local'),
    endsOn: date('ends_on', { mode: 'string' }).notNull(),
    endsAtLocal: time('ends_at_local'),
    timezone: text('timezone').notNull(),
    state: text('state').notNull().default('scheduled'),
  },
  (table) => [
    index('registration_windows_season_type_state_idx').on(
      table.seasonId,
      table.windowType,
      table.state,
    ),
    check(
      'registration_windows_type_ck',
      sql`${table.windowType} in ('team_entry', 'roster_registration', 'roster_transfer')`,
    ),
    check('registration_windows_date_order_ck', sql`${table.endsOn} >= ${table.startsOn}`),
  ],
)

export const registrationWindowTransitions = appSchema.table('registration_window_transitions', {
  ...immutableRecordColumns(),
  windowId: uuid('window_id')
    .notNull()
    .references(() => registrationWindows.id),
  action: text('action').notNull(),
  fromState: text('from_state').notNull(),
  toState: text('to_state').notNull(),
  reason: text('reason').notNull(),
  actorId: uuid('actor_id').notNull(),
})

export const rosterRuleSets = appSchema.table(
  'roster_rule_sets',
  {
    ...immutableRecordColumns(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'restrict' }),
    versionNumber: integer('version_number').notNull(),
    minimumSize: integer('minimum_size').notNull(),
    maximumSize: integer('maximum_size').notNull(),
    readinessRequired: boolean('readiness_required').notNull(),
    effectiveFromAt: timestamp('effective_from_at', { withTimezone: true }).notNull(),
    authorId: uuid('author_id').notNull(),
  },
  (table) => [
    unique('roster_rule_sets_season_version_uq').on(table.seasonId, table.versionNumber),
    check(
      'roster_rule_sets_size_ck',
      sql`${table.minimumSize} >= 0 and ${table.maximumSize} >= ${table.minimumSize}`,
    ),
  ],
)

export const legionnaireQuotaVersions = appSchema.table(
  'legionnaire_quota_versions',
  {
    ...immutableRecordColumns(),
    rosterRuleSetId: uuid('roster_rule_set_id')
      .notNull()
      .references(() => rosterRuleSets.id),
    baseLimit: integer('base_limit').notNull(),
    additionalLimit: integer('additional_limit'),
    additionalBirthDateCutoff: date('additional_birth_date_cutoff', { mode: 'string' }),
  },
  (table) => [
    unique('legionnaire_quota_versions_rule_uq').on(table.rosterRuleSetId),
    check('legionnaire_quota_versions_base_ck', sql`${table.baseLimit} >= 0`),
    check(
      'legionnaire_quota_versions_additional_ck',
      sql`(${table.additionalLimit} is null and ${table.additionalBirthDateCutoff} is null) or (${table.additionalLimit} > 0 and ${table.additionalBirthDateCutoff} is not null)`,
    ),
  ],
)

export const seasonRosters = appSchema.table(
  'season_rosters',
  {
    ...mutableRecordColumns(),
    seasonEntryId: uuid('season_entry_id')
      .notNull()
      .references(() => seasonEntries.id),
    currentRuleSetId: uuid('current_rule_set_id').references(() => rosterRuleSets.id),
    currentReadinessDecisionId: uuid('current_readiness_decision_id').references(
      (): AnyPgColumn => rosterReadinessDecisions.id,
    ),
  },
  (table) => [unique('season_rosters_entry_uq').on(table.seasonEntryId)],
)

export const rosterReadinessDecisions = appSchema.table('roster_readiness_decisions', {
  ...immutableRecordColumns(),
  rosterId: uuid('roster_id')
    .notNull()
    .references(() => seasonRosters.id),
  rosterVersion: bigint('roster_version', { mode: 'bigint' }).notNull(),
  ruleSetId: uuid('rule_set_id')
    .notNull()
    .references(() => rosterRuleSets.id),
  inputHash: text('input_hash').notNull(),
  ready: boolean('ready').notNull(),
  blockingReasonCodes: text('blocking_reason_codes').array().notNull(),
  actorId: uuid('actor_id').notNull(),
})

export const rosterEntries = appSchema.table(
  'roster_entries',
  {
    ...mutableRecordColumns(),
    rosterId: uuid('roster_id')
      .notNull()
      .references(() => seasonRosters.id),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),
    state: text('state').notNull().default('pending'),
    playingPosition: text('playing_position'),
    currentClassificationDecisionId: uuid('current_classification_decision_id').references(
      (): AnyPgColumn => legionnaireClassificationDecisions.id,
    ),
    currentDecisionId: uuid('current_decision_id').references(
      (): AnyPgColumn => rosterEntryDecisions.id,
    ),
  },
  (table) => [
    index('roster_entries_roster_state_idx').on(table.rosterId, table.state),
    index('roster_entries_player_idx').on(table.playerId),
    check(
      'roster_entries_state_ck',
      sql`${table.state} in ('pending', 'active', 'rejected', 'ended')`,
    ),
  ],
)

export const rosterRegistrationPeriods = appSchema.table(
  'roster_registration_periods',
  {
    ...mutableRecordColumns(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'restrict' }),
    rosterEntryId: uuid('roster_entry_id')
      .notNull()
      .references(() => rosterEntries.id),
    effectivePeriod: dateRange('effective_period').notNull(),
    approvalState: text('approval_state').notNull().default('approved'),
    decisionId: uuid('decision_id').references((): AnyPgColumn => rosterEntryDecisions.id),
    currentRevisionId: uuid('current_revision_id').references(
      (): AnyPgColumn => rosterRegistrationPeriodRevisions.id,
    ),
  },
  (table) => [
    index('roster_registration_periods_entry_idx').on(table.rosterEntryId),
    check(
      'roster_registration_periods_state_ck',
      sql`${table.approvalState} in ('approved', 'voided')`,
    ),
    check(
      'roster_registration_periods_bounds_ck',
      sql`not isempty(${table.effectivePeriod}) and lower_inc(${table.effectivePeriod}) and not upper_inc(${table.effectivePeriod})`,
    ),
  ],
)

export const rosterRegistrationPeriodRevisions = appSchema.table(
  'roster_registration_period_revisions',
  {
    ...immutableRecordColumns(),
    periodId: uuid('period_id')
      .notNull()
      .references(() => rosterRegistrationPeriods.id),
    revisionNumber: integer('revision_number').notNull(),
    effectivePeriod: dateRange('effective_period').notNull(),
    approvalState: text('approval_state').notNull(),
    action: text('action').notNull(),
    reason: text('reason').notNull(),
    actorId: uuid('actor_id').notNull(),
    supersedesRevisionId: uuid('supersedes_revision_id').references(
      (): AnyPgColumn => rosterRegistrationPeriodRevisions.id,
    ),
  },
  (table) => [
    unique('roster_registration_period_revisions_number_uq').on(
      table.periodId,
      table.revisionNumber,
    ),
    check(
      'roster_registration_period_revisions_state_ck',
      sql`${table.approvalState} in ('approved', 'voided')`,
    ),
    check(
      'roster_registration_period_revisions_action_ck',
      sql`${table.action} in ('opened', 'closed', 'corrected', 'voided')`,
    ),
  ],
)

export const rosterEntryDecisions = appSchema.table(
  'roster_entry_decisions',
  {
    ...immutableRecordColumns(),
    rosterEntryId: uuid('roster_entry_id')
      .notNull()
      .references(() => rosterEntries.id),
    action: text('action').notNull(),
    reason: text('reason').notNull(),
    actorId: uuid('actor_id').notNull(),
    supportingReferenceId: uuid('supporting_reference_id'), // Governance FK in #71/#72.
  },
  (table) => [
    check(
      'roster_entry_decisions_action_ck',
      sql`${table.action} in ('submit', 'activate', 'reject', 'end')`,
    ),
  ],
)

export const legionnaireClassificationDecisions = appSchema.table(
  'legionnaire_classification_decisions',
  {
    ...immutableRecordColumns(),
    rosterEntryId: uuid('roster_entry_id')
      .notNull()
      .references(() => rosterEntries.id),
    classification: text('classification').notNull(),
    basis: text('basis').notNull(),
    actorId: uuid('actor_id').notNull(),
    supersedesDecisionId: uuid('supersedes_decision_id').references(
      (): AnyPgColumn => legionnaireClassificationDecisions.id,
    ),
  },
  (table) => [
    check(
      'legionnaire_classification_decisions_type_ck',
      sql`${table.classification} in ('local', 'legionnaire')`,
    ),
  ],
)

export const rosterTransfers = appSchema.table(
  'roster_transfers',
  {
    ...mutableRecordColumns(),
    sourceRosterEntryId: uuid('source_roster_entry_id')
      .notNull()
      .references(() => rosterEntries.id),
    destinationRosterEntryId: uuid('destination_roster_entry_id').references(
      () => rosterEntries.id,
    ),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'restrict' }),
    transferWindowId: uuid('transfer_window_id')
      .notNull()
      .references(() => registrationWindows.id),
    effectiveOn: date('effective_on', { mode: 'string' }).notNull(),
    state: text('state').notNull().default('proposed'),
    reason: text('reason').notNull(),
  },
  (table) => [
    check(
      'roster_transfers_distinct_entries_ck',
      sql`${table.destinationRosterEntryId} is null or ${table.sourceRosterEntryId} <> ${table.destinationRosterEntryId}`,
    ),
  ],
)

export const rosterEligibilityRulings = appSchema.table('roster_eligibility_rulings', {
  ...immutableRecordColumns(),
  rosterEntryId: uuid('roster_entry_id')
    .notNull()
    .references(() => rosterEntries.id),
  waivedRuleCode: text('waived_rule_code').notNull(),
  effectivePeriod: dateRange('effective_period').notNull(),
  reason: text('reason').notNull(),
  actorId: uuid('actor_id').notNull(),
  supportingReferenceId: uuid('supporting_reference_id'), // Governance FK in #71/#72.
})
