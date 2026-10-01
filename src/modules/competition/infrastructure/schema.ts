import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

import { immutableRecordColumns, mutableRecordColumns } from '../../../server/db/columns'
import { appSchema } from '../../../server/db/schema'

// Competition owns current designations; Season sporting state, visibility and archive
// state remain independent. All IDs are application-generated UUIDv7 values.
export const competitions = appSchema.table(
  'competitions',
  {
    ...mutableRecordColumns(),
    displayName: text('display_name').notNull(),
    description: text('description'),
    visibility: text('visibility').notNull().default('private'),
    archiveState: text('archive_state').notNull().default('active'),
    currentSlugId: uuid('current_slug_id').references((): AnyPgColumn => competitionSlugs.id),
    currentProfileVersionId: uuid('current_profile_version_id').references(
      (): AnyPgColumn => competitionProfileVersions.id,
    ),
    currentSeasonId: uuid('current_season_id').references((): AnyPgColumn => seasons.id),
  },
  (table) => [
    check('competitions_visibility_ck', sql`${table.visibility} in ('private', 'public')`),
    check('competitions_archive_state_ck', sql`${table.archiveState} in ('active', 'archived')`),
  ],
)

export const competitionSlugs = appSchema.table(
  'competition_slugs',
  {
    ...immutableRecordColumns(),
    competitionId: uuid('competition_id')
      .notNull()
      .references(() => competitions.id),
    displaySlug: text('display_slug').notNull(),
    normalizedSlug: text('normalized_slug').notNull(),
    validFromAt: timestamp('valid_from_at', { withTimezone: true }).notNull(),
    replacedBySlugId: uuid('replaced_by_slug_id').references(
      (): AnyPgColumn => competitionSlugs.id,
    ),
  },
  (table) => [
    uniqueIndex('competition_slugs_normalized_uq').on(table.normalizedSlug),
    unique('competition_slugs_owner_id_uq').on(table.competitionId, table.id),
    index('competition_slugs_owner_idx').on(table.competitionId),
  ],
)

export const competitionProfileVersions = appSchema.table(
  'competition_profile_versions',
  {
    ...immutableRecordColumns(),
    competitionId: uuid('competition_id')
      .notNull()
      .references(() => competitions.id),
    officialName: text('official_name').notNull(),
    shortName: text('short_name'),
    description: text('description'),
    logoMediaAssetId: uuid('logo_media_asset_id'), // Media FK is added with #71/#72.
    correctionReason: text('correction_reason'),
    authorId: uuid('author_id').notNull(),
  },
  (table) => [
    unique('competition_profile_versions_owner_id_uq').on(table.competitionId, table.id),
    index('competition_profile_versions_owner_idx').on(table.competitionId),
  ],
)

export const seasons = appSchema.table(
  'seasons',
  {
    ...mutableRecordColumns(),
    competitionId: uuid('competition_id')
      .notNull()
      .references(() => competitions.id),
    name: text('name').notNull(),
    currentSlugId: uuid('current_slug_id').references((): AnyPgColumn => seasonSlugs.id),
    timezone: text('timezone').notNull(),
    startsOn: date('starts_on', { mode: 'string' }),
    endsOn: date('ends_on', { mode: 'string' }),
    sportingState: text('sporting_state').notNull().default('preparing'),
    visibility: text('visibility').notNull().default('private'),
    archiveState: text('archive_state').notNull().default('active'),
    currentFormatVersionId: uuid('current_format_version_id').references(
      (): AnyPgColumn => competitionFormatVersions.id,
    ),
  },
  (table) => [
    unique('seasons_competition_id_id_uq').on(table.competitionId, table.id),
    index('seasons_competition_state_idx').on(
      table.competitionId,
      table.visibility,
      table.sportingState,
    ),
    check(
      'seasons_sporting_state_ck',
      sql`${table.sportingState} in ('preparing', 'active', 'completed', 'cancelled', 'abandoned')`,
    ),
    check('seasons_visibility_ck', sql`${table.visibility} in ('private', 'public')`),
    check('seasons_archive_state_ck', sql`${table.archiveState} in ('active', 'archived')`),
    check(
      'seasons_date_order_ck',
      sql`${table.endsOn} is null or ${table.startsOn} is null or ${table.endsOn} >= ${table.startsOn}`,
    ),
  ],
)

export const seasonSlugs = appSchema.table(
  'season_slugs',
  {
    ...immutableRecordColumns(),
    competitionId: uuid('competition_id')
      .notNull()
      .references(() => competitions.id),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id),
    displaySlug: text('display_slug').notNull(),
    normalizedSlug: text('normalized_slug').notNull(),
    validFromAt: timestamp('valid_from_at', { withTimezone: true }).notNull(),
    replacedBySlugId: uuid('replaced_by_slug_id').references((): AnyPgColumn => seasonSlugs.id),
  },
  (table) => [
    uniqueIndex('season_slugs_competition_normalized_uq').on(
      table.competitionId,
      table.normalizedSlug,
    ),
    unique('season_slugs_owner_id_uq').on(table.seasonId, table.id),
    foreignKey({
      name: 'season_slugs_season_owner_fk',
      columns: [table.competitionId, table.seasonId],
      foreignColumns: [seasons.competitionId, seasons.id],
    }),
  ],
)

export const seasonStateTransitions = appSchema.table('season_state_transitions', {
  ...immutableRecordColumns(),
  seasonId: uuid('season_id')
    .notNull()
    .references(() => seasons.id),
  fromState: text('from_state').notNull(),
  toState: text('to_state').notNull(),
  reason: text('reason').notNull(),
  actorId: uuid('actor_id').notNull(),
  relatedRulingId: uuid('related_ruling_id'),
  relatedAmendmentId: uuid('related_amendment_id').references(
    (): AnyPgColumn => formatAmendments.id,
  ),
})

export const seasonVisibilityTransitions = appSchema.table('season_visibility_transitions', {
  ...immutableRecordColumns(),
  seasonId: uuid('season_id')
    .notNull()
    .references(() => seasons.id),
  fromVisibility: text('from_visibility').notNull(),
  toVisibility: text('to_visibility').notNull(),
  reason: text('reason').notNull(),
  actorId: uuid('actor_id').notNull(),
})

export const seasonArchiveTransitions = appSchema.table('season_archive_transitions', {
  ...immutableRecordColumns(),
  seasonId: uuid('season_id')
    .notNull()
    .references(() => seasons.id),
  action: text('action').notNull(),
  reason: text('reason').notNull(),
  actorId: uuid('actor_id').notNull(),
})

export const currentSeasonDesignations = appSchema.table(
  'current_season_designations',
  {
    ...immutableRecordColumns(),
    competitionId: uuid('competition_id')
      .notNull()
      .references(() => competitions.id),
    previousSeasonId: uuid('previous_season_id').references(() => seasons.id),
    selectedSeasonId: uuid('selected_season_id')
      .notNull()
      .references(() => seasons.id),
    reason: text('reason').notNull(),
    actorId: uuid('actor_id').notNull(),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    foreignKey({
      name: 'current_season_designations_owner_fk',
      columns: [table.competitionId, table.selectedSeasonId],
      foreignColumns: [seasons.competitionId, seasons.id],
    }),
  ],
)

export const competitionFormats = appSchema.table(
  'competition_formats',
  {
    ...mutableRecordColumns(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id),
  },
  (table) => [unique('competition_formats_season_uq').on(table.seasonId)],
)

export const competitionFormatDrafts = appSchema.table(
  'competition_format_drafts',
  {
    ...mutableRecordColumns(),
    formatId: uuid('format_id')
      .notNull()
      .references(() => competitionFormats.id),
    editingContext: text('editing_context').notNull(),
    baseVersionId: uuid('base_version_id').references(
      (): AnyPgColumn => competitionFormatVersions.id,
    ),
    validationState: text('validation_state').notNull().default('unvalidated'),
    validationHash: text('validation_hash'),
  },
  (table) => [
    unique('competition_format_drafts_context_uq').on(table.formatId, table.editingContext),
  ],
)

export const competitionFormatVersions = appSchema.table(
  'competition_format_versions',
  {
    ...immutableRecordColumns(),
    formatId: uuid('format_id')
      .notNull()
      .references(() => competitionFormats.id),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id),
    versionNumber: integer('version_number').notNull(),
    contentHash: text('content_hash').notNull(),
    sourceDraftId: uuid('source_draft_id')
      .notNull()
      .references(() => competitionFormatDrafts.id),
    authorId: uuid('author_id').notNull(),
  },
  (table) => [
    unique('competition_format_versions_number_uq').on(table.formatId, table.versionNumber),
    unique('competition_format_versions_season_id_uq').on(table.seasonId, table.id),
    check('competition_format_versions_number_ck', sql`${table.versionNumber} > 0`),
  ],
)

export const competitionFormatActivations = appSchema.table(
  'competition_format_activations',
  {
    ...immutableRecordColumns(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id),
    formatVersionId: uuid('format_version_id')
      .notNull()
      .references(() => competitionFormatVersions.id),
    replacedActivationId: uuid('replaced_activation_id').references(
      (): AnyPgColumn => competitionFormatActivations.id,
    ),
    actorId: uuid('actor_id').notNull(),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    unique('competition_format_activations_version_uq').on(table.formatVersionId),
    foreignKey({
      name: 'competition_format_activations_owner_fk',
      columns: [table.seasonId, table.formatVersionId],
      foreignColumns: [competitionFormatVersions.seasonId, competitionFormatVersions.id],
    }),
  ],
)

export const formatDraftStages = appSchema.table(
  'format_draft_stages',
  {
    ...mutableRecordColumns(),
    draftId: uuid('draft_id')
      .notNull()
      .references(() => competitionFormatDrafts.id),
    name: text('name').notNull(),
    code: text('code').notNull(),
    position: integer('position').notNull(),
    formatType: text('format_type').notNull(),
    groupingMode: text('grouping_mode'),
  },
  (table) => [
    unique('format_draft_stages_code_uq').on(table.draftId, table.code),
    unique('format_draft_stages_position_uq').on(table.draftId, table.position),
    check('format_draft_stages_type_ck', sql`${table.formatType} in ('league', 'knockout')`),
    check('format_draft_stages_position_ck', sql`${table.position} > 0`),
  ],
)

export const formatDraftStageGroups = appSchema.table(
  'format_draft_stage_groups',
  {
    ...mutableRecordColumns(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => formatDraftStages.id),
    name: text('name').notNull(),
    code: text('code').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    unique('format_draft_stage_groups_code_uq').on(table.stageId, table.code),
    unique('format_draft_stage_groups_position_uq').on(table.stageId, table.position),
  ],
)

export const formatDraftParticipantSlots = appSchema.table(
  'format_draft_participant_slots',
  {
    ...mutableRecordColumns(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => formatDraftStages.id),
    groupId: uuid('group_id').references(() => formatDraftStageGroups.id),
    slotCode: text('slot_code').notNull(),
    position: integer('position').notNull(),
    sourceKind: text('source_kind').notNull(),
    sourceSeasonEntryId: uuid('source_season_entry_id'), // Registration FK in #72.
    sourceStageId: uuid('source_stage_id').references(() => formatDraftStages.id),
    sourceOutputCode: text('source_output_code'),
  },
  (table) => [
    unique('format_draft_participant_slots_code_uq').on(table.stageId, table.slotCode),
    unique('format_draft_participant_slots_position_uq').on(table.stageId, table.position),
  ],
)

export const formatDraftDependencies = appSchema.table(
  'format_draft_dependencies',
  {
    ...mutableRecordColumns(),
    draftId: uuid('draft_id')
      .notNull()
      .references(() => competitionFormatDrafts.id),
    sourceStageId: uuid('source_stage_id')
      .notNull()
      .references(() => formatDraftStages.id),
    sourceOutputCode: text('source_output_code').notNull(),
    destinationSlotId: uuid('destination_slot_id')
      .notNull()
      .references(() => formatDraftParticipantSlots.id),
  },
  (table) => [unique('format_draft_dependencies_destination_uq').on(table.destinationSlotId)],
)

export const formatDraftRankingRuleSets = appSchema.table(
  'format_draft_ranking_rule_sets',
  {
    ...mutableRecordColumns(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => formatDraftStages.id),
    name: text('name').notNull(),
    fairPlayEnabled: boolean('fair_play_enabled').notNull().default(false),
    yellowCardWeight: integer('yellow_card_weight'),
    secondYellowCardWeight: integer('second_yellow_card_weight'),
    directRedCardWeight: integer('direct_red_card_weight'),
  },
  (table) => [
    unique('format_draft_ranking_stage_uq').on(table.stageId),
    check(
      'format_draft_ranking_weights_ck',
      sql`(${table.yellowCardWeight} is null or ${table.yellowCardWeight} >= 0) and (${table.secondYellowCardWeight} is null or ${table.secondYellowCardWeight} >= 0) and (${table.directRedCardWeight} is null or ${table.directRedCardWeight} >= 0)`,
    ),
  ],
)

export const formatDraftPointsSchemes = appSchema.table(
  'format_draft_points_schemes',
  {
    ...mutableRecordColumns(),
    rankingRuleSetId: uuid('ranking_rule_set_id')
      .notNull()
      .references(() => formatDraftRankingRuleSets.id),
    winPoints: integer('win_points').notNull().default(3),
    drawPoints: integer('draw_points').notNull().default(1),
    lossPoints: integer('loss_points').notNull().default(0),
  },
  (table) => [unique('format_draft_points_scheme_rule_uq').on(table.rankingRuleSetId)],
)

export const formatDraftTieBreakers = appSchema.table(
  'format_draft_tie_breakers',
  {
    ...mutableRecordColumns(),
    rankingRuleSetId: uuid('ranking_rule_set_id')
      .notNull()
      .references(() => formatDraftRankingRuleSets.id),
    position: integer('position').notNull(),
    criterion: text('criterion').notNull(),
    direction: text('direction').notNull(),
  },
  (table) => [
    unique('format_draft_tie_breakers_position_uq').on(table.rankingRuleSetId, table.position),
    check('format_draft_tie_breakers_direction_ck', sql`${table.direction} in ('asc', 'desc')`),
  ],
)

export const formatDraftDrawPools = appSchema.table(
  'format_draft_draw_pools',
  {
    ...mutableRecordColumns(),
    draftId: uuid('draft_id')
      .notNull()
      .references(() => competitionFormatDrafts.id),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => formatDraftStages.id),
    code: text('code').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [unique('format_draft_draw_pools_code_uq').on(table.stageId, table.code)],
)

export const formatDraftQualificationRules = appSchema.table(
  'format_draft_qualification_rules',
  {
    ...mutableRecordColumns(),
    sourceStageId: uuid('source_stage_id')
      .notNull()
      .references(() => formatDraftStages.id),
    sourceGroupId: uuid('source_group_id').references(() => formatDraftStageGroups.id),
    rankFrom: integer('rank_from').notNull(),
    rankThrough: integer('rank_through').notNull(),
    destinationSlotId: uuid('destination_slot_id').references(() => formatDraftParticipantSlots.id),
    destinationDrawPoolId: uuid('destination_draw_pool_id').references(
      () => formatDraftDrawPools.id,
    ),
  },
  (table) => [
    check(
      'format_draft_qualification_rank_ck',
      sql`${table.rankFrom} > 0 and ${table.rankThrough} >= ${table.rankFrom}`,
    ),
    check(
      'format_draft_qualification_destination_ck',
      sql`(${table.destinationSlotId} is null) <> (${table.destinationDrawPoolId} is null)`,
    ),
  ],
)

export const formatDraftDrawPots = appSchema.table(
  'format_draft_draw_pots',
  {
    ...mutableRecordColumns(),
    drawPoolId: uuid('draw_pool_id')
      .notNull()
      .references(() => formatDraftDrawPools.id),
    code: text('code').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [unique('format_draft_draw_pots_code_uq').on(table.drawPoolId, table.code)],
)

export const formatDraftDrawConstraints = appSchema.table('format_draft_draw_constraints', {
  ...mutableRecordColumns(),
  drawPoolId: uuid('draw_pool_id')
    .notNull()
    .references(() => formatDraftDrawPools.id),
  kind: text('kind').notNull(),
  sourcePotId: uuid('source_pot_id').references(() => formatDraftDrawPots.id),
  targetPotId: uuid('target_pot_id').references(() => formatDraftDrawPots.id),
  parameter: text('parameter'),
})

export const formatDraftKnockoutRounds = appSchema.table(
  'format_draft_knockout_rounds',
  {
    ...mutableRecordColumns(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => formatDraftStages.id),
    code: text('code').notNull(),
    position: integer('position').notNull(),
    drawMode: text('draw_mode').notNull(),
    legCount: integer('leg_count').notNull(),
  },
  (table) => [
    unique('format_draft_knockout_rounds_code_uq').on(table.stageId, table.code),
    unique('format_draft_knockout_rounds_position_uq').on(table.stageId, table.position),
    check('format_draft_knockout_rounds_leg_count_ck', sql`${table.legCount} in (1, 2)`),
    check(
      'format_draft_knockout_rounds_draw_mode_ck',
      sql`${table.drawMode} in ('fixed', 'redraw')`,
    ),
  ],
)

export const formatDraftKnockoutTies = appSchema.table(
  'format_draft_knockout_ties',
  {
    ...mutableRecordColumns(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => formatDraftKnockoutRounds.id),
    position: integer('position').notNull(),
    placementKind: text('placement_kind'),
    winnerDestinationSlotId: uuid('winner_destination_slot_id').references(
      () => formatDraftParticipantSlots.id,
    ),
  },
  (table) => [
    unique('format_draft_knockout_ties_position_uq').on(table.roundId, table.position),
    check(
      'format_draft_knockout_ties_placement_ck',
      sql`${table.placementKind} is null or ${table.placementKind} in ('final', 'third_place')`,
    ),
  ],
)

export const formatDraftTieParticipantSlots = appSchema.table(
  'format_draft_tie_participant_slots',
  {
    ...mutableRecordColumns(),
    tieId: uuid('tie_id')
      .notNull()
      .references(() => formatDraftKnockoutTies.id),
    side: text('side').notNull(),
    sourceSlotId: uuid('source_slot_id').references(() => formatDraftParticipantSlots.id),
    sourceDrawPoolId: uuid('source_draw_pool_id').references(() => formatDraftDrawPools.id),
  },
  (table) => [
    unique('format_draft_tie_participant_side_uq').on(table.tieId, table.side),
    check('format_draft_tie_participant_side_ck', sql`${table.side} in ('home', 'away')`),
    check(
      'format_draft_tie_participant_source_ck',
      sql`(${table.sourceSlotId} is null) <> (${table.sourceDrawPoolId} is null)`,
    ),
  ],
)

export const formatDraftResolutionSteps = appSchema.table(
  'format_draft_resolution_steps',
  {
    ...mutableRecordColumns(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => formatDraftKnockoutRounds.id),
    position: integer('position').notNull(),
    stepType: text('step_type').notNull(),
  },
  (table) => [
    unique('format_draft_resolution_steps_position_uq').on(table.roundId, table.position),
    check(
      'format_draft_resolution_steps_type_ck',
      sql`${table.stepType} in ('aggregate', 'regulation', 'extra_time', 'replay', 'penalties')`,
    ),
  ],
)

export const formatAmendments = appSchema.table(
  'format_amendments',
  {
    ...mutableRecordColumns(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id),
    baseVersionId: uuid('base_version_id')
      .notNull()
      .references(() => competitionFormatVersions.id),
    targetDraftId: uuid('target_draft_id')
      .notNull()
      .references(() => competitionFormatDrafts.id),
    appliedVersionId: uuid('applied_version_id').references(() => competitionFormatVersions.id),
    state: text('state').notNull().default('preparing'),
    reason: text('reason').notNull(),
    supportingReferenceId: uuid('supporting_reference_id'), // Governance FK in #71/#72.
  },
  (table) => [
    check(
      'format_amendments_state_ck',
      sql`${table.state} in ('preparing', 'validated', 'applied', 'rejected')`,
    ),
  ],
)

export const formatAmendmentTransitions = appSchema.table(
  'format_amendment_transitions',
  {
    ...immutableRecordColumns(),
    amendmentId: uuid('amendment_id')
      .notNull()
      .references(() => formatAmendments.id),
    fromState: text('from_state').notNull(),
    toState: text('to_state').notNull(),
    reason: text('reason').notNull(),
    actorId: uuid('actor_id').notNull(),
    activatedVersionId: uuid('activated_version_id').references(() => competitionFormatVersions.id),
  },
  (table) => [
    check(
      'format_amendment_transitions_state_ck',
      sql`${table.toState} in ('preparing', 'validated', 'applied', 'rejected')`,
    ),
  ],
)

export const formatAmendmentStages = appSchema.table(
  'format_amendment_stages',
  {
    ...immutableRecordColumns(),
    amendmentId: uuid('amendment_id')
      .notNull()
      .references(() => formatAmendments.id),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => competitionStages.id),
    effect: text('effect').notNull(),
  },
  (table) => [
    unique('format_amendment_stages_stage_uq').on(table.amendmentId, table.stageId),
    check(
      'format_amendment_stages_effect_ck',
      sql`${table.effect} in ('changed', 'added', 'removed', 'abandoned')`,
    ),
  ],
)

export const formatTemplates = appSchema.table(
  'format_templates',
  {
    ...mutableRecordColumns(),
    name: text('name').notNull(),
    archiveState: text('archive_state').notNull().default('active'),
    currentVersionId: uuid('current_version_id').references(
      (): AnyPgColumn => formatTemplateVersions.id,
    ),
  },
  (table) => [
    check(
      'format_templates_archive_state_ck',
      sql`${table.archiveState} in ('active', 'archived')`,
    ),
  ],
)

export const formatTemplateVersions = appSchema.table(
  'format_template_versions',
  {
    ...immutableRecordColumns(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => formatTemplates.id),
    versionNumber: integer('version_number').notNull(),
    blueprintSchemaVersion: integer('blueprint_schema_version').notNull(),
    blueprint: jsonb('blueprint').notNull(),
    validationHash: text('validation_hash').notNull(),
    authorId: uuid('author_id').notNull(),
  },
  (table) => [
    unique('format_template_versions_number_uq').on(table.templateId, table.versionNumber),
    check('format_template_versions_number_ck', sql`${table.versionNumber} > 0`),
  ],
)

export const competitionStages = appSchema.table(
  'competition_stages',
  {
    ...mutableRecordColumns(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id),
    code: text('code').notNull(),
    sportingState: text('sporting_state').notNull().default('configuring'),
    currentVersionId: uuid('current_version_id').references(
      (): AnyPgColumn => competitionStageVersions.id,
    ),
    currentFinalSnapshotId: uuid('current_final_snapshot_id'), // Progression FK in #70/#72.
  },
  (table) => [
    unique('competition_stages_season_code_uq').on(table.seasonId, table.code),
    check(
      'competition_stages_state_ck',
      sql`${table.sportingState} in ('configuring', 'ready', 'active', 'awaiting_finalization', 'finalized', 'removed', 'abandoned')`,
    ),
  ],
)

export const competitionStageVersions = appSchema.table(
  'competition_stage_versions',
  {
    ...immutableRecordColumns(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => competitionStages.id),
    formatVersionId: uuid('format_version_id')
      .notNull()
      .references(() => competitionFormatVersions.id),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    formatType: text('format_type').notNull(),
    groupingMode: text('grouping_mode'),
    configurationHash: text('configuration_hash').notNull(),
  },
  (table) => [
    unique('competition_stage_versions_order_uq').on(table.formatVersionId, table.position),
    unique('competition_stage_versions_stage_id_uq').on(table.stageId, table.id),
    check('competition_stage_versions_type_ck', sql`${table.formatType} in ('league', 'knockout')`),
    check('competition_stage_versions_position_ck', sql`${table.position} > 0`),
  ],
)

export const stageStateTransitions = appSchema.table('stage_state_transitions', {
  ...immutableRecordColumns(),
  stageId: uuid('stage_id')
    .notNull()
    .references(() => competitionStages.id),
  fromState: text('from_state').notNull(),
  toState: text('to_state').notNull(),
  reason: text('reason').notNull(),
  actorId: uuid('actor_id').notNull(),
  amendmentId: uuid('amendment_id').references(() => formatAmendments.id),
  rulingId: uuid('ruling_id'), // Progression FK in #70/#72.
})

export const stageDependencies = appSchema.table(
  'stage_dependencies',
  {
    ...immutableRecordColumns(),
    formatVersionId: uuid('format_version_id')
      .notNull()
      .references(() => competitionFormatVersions.id),
    sourceStageId: uuid('source_stage_id')
      .notNull()
      .references(() => competitionStages.id),
    sourceOutputCode: text('source_output_code').notNull(),
    destinationStageId: uuid('destination_stage_id')
      .notNull()
      .references(() => competitionStages.id),
    destinationSlotCode: text('destination_slot_code').notNull(),
  },
  (table) => [
    unique('stage_dependencies_destination_uq').on(
      table.formatVersionId,
      table.destinationStageId,
      table.destinationSlotCode,
    ),
    check(
      'stage_dependencies_no_self_ck',
      sql`${table.sourceStageId} <> ${table.destinationStageId}`,
    ),
  ],
)

export const stageGroups = appSchema.table(
  'stage_groups',
  {
    ...mutableRecordColumns(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => competitionStages.id),
    stableCode: text('stable_code').notNull(),
  },
  (table) => [unique('stage_groups_code_uq').on(table.stageId, table.stableCode)],
)

export const stageGroupVersions = appSchema.table(
  'stage_group_versions',
  {
    ...immutableRecordColumns(),
    stageVersionId: uuid('stage_version_id')
      .notNull()
      .references(() => competitionStageVersions.id),
    groupId: uuid('group_id')
      .notNull()
      .references(() => stageGroups.id),
    name: text('name').notNull(),
    code: text('code').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    unique('stage_group_versions_group_uq').on(table.stageVersionId, table.groupId),
    unique('stage_group_versions_code_uq').on(table.stageVersionId, table.code),
    unique('stage_group_versions_position_uq').on(table.stageVersionId, table.position),
  ],
)
