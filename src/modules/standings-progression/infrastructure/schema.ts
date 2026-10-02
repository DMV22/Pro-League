import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

import {
  competitionStageVersions,
  competitionStages,
  stageGroups,
} from '../../competition/infrastructure/schema'
import { seasonEntries } from '../../registration/infrastructure/schema'
import {
  disciplinarySummaryVersions,
  matchResultVersions,
  penaltyShootoutVersions,
} from '../../match/infrastructure/schema'
import { immutableRecordColumns, mutableRecordColumns } from '../../../server/db/columns'
import { appSchema } from '../../../server/db/schema'

// Provisional standings and unresolved progression are calculated, not stored as official rows.
export const stageParticipantSlots = appSchema.table(
  'stage_participant_slots',
  {
    ...mutableRecordColumns(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => competitionStages.id, { onDelete: 'restrict' }),
    stageVersionId: uuid('stage_version_id')
      .notNull()
      .references(() => competitionStageVersions.id, { onDelete: 'restrict' }),
    stableCode: text('stable_code').notNull(),
    position: integer('position').notNull(),
    expectedSourceKind: text('expected_source_kind').notNull(),
    expectedSourceSlotId: uuid('expected_source_slot_id'),
    currentAssignmentId: uuid('current_assignment_id').references(
      (): AnyPgColumn => stageParticipantAssignments.id,
    ),
  },
  (table) => [
    unique('stage_participant_slots_stage_code_uq').on(table.stageId, table.stableCode),
    unique('stage_participant_slots_stage_position_uq').on(table.stageId, table.position),
    check('stage_participant_slots_position_ck', sql`${table.position} > 0`),
    check(
      'stage_participant_slots_source_ck',
      sql`${table.expectedSourceKind} in ('direct_entry', 'qualification', 'draw', 'bye')`,
    ),
  ],
)

export const stageParticipantAssignments = appSchema.table('stage_participant_assignments', {
  ...immutableRecordColumns(),
  slotId: uuid('slot_id')
    .notNull()
    .references(() => stageParticipantSlots.id),
  seasonEntryId: uuid('season_entry_id')
    .notNull()
    .references(() => seasonEntries.id, { onDelete: 'restrict' }),
  sourceQualificationOutputId: uuid('source_qualification_output_id').references(
    (): AnyPgColumn => qualificationOutputs.id,
  ),
  sourceDrawOutcomeAssignmentId: uuid('source_draw_outcome_assignment_id').references(
    (): AnyPgColumn => drawOutcomeAssignments.id,
  ),
  reason: text('reason').notNull(),
  actorId: uuid('actor_id').notNull(),
  supersedesAssignmentId: uuid('supersedes_assignment_id').references(
    (): AnyPgColumn => stageParticipantAssignments.id,
  ),
})

export const rankingRuleSets = appSchema.table(
  'ranking_rule_sets',
  {
    ...immutableRecordColumns(),
    stageVersionId: uuid('stage_version_id')
      .notNull()
      .references(() => competitionStageVersions.id, { onDelete: 'restrict' }),
    validationHash: text('validation_hash').notNull(),
  },
  (table) => [unique('ranking_rule_sets_stage_version_uq').on(table.stageVersionId)],
)

export const pointsSchemes = appSchema.table(
  'points_schemes',
  {
    ...immutableRecordColumns(),
    rankingRuleSetId: uuid('ranking_rule_set_id')
      .notNull()
      .references(() => rankingRuleSets.id),
    winPoints: integer('win_points').notNull().default(3),
    drawPoints: integer('draw_points').notNull().default(1),
    lossPoints: integer('loss_points').notNull().default(0),
  },
  (table) => [unique('points_schemes_rule_set_uq').on(table.rankingRuleSetId)],
)

export const tieBreakers = appSchema.table(
  'tie_breakers',
  {
    ...immutableRecordColumns(),
    rankingRuleSetId: uuid('ranking_rule_set_id')
      .notNull()
      .references(() => rankingRuleSets.id),
    position: integer('position').notNull(),
    criterion: text('criterion').notNull(),
    direction: text('direction').notNull().default('desc'),
  },
  (table) => [
    unique('tie_breakers_rule_position_uq').on(table.rankingRuleSetId, table.position),
    check('tie_breakers_position_ck', sql`${table.position} > 0`),
    check('tie_breakers_direction_ck', sql`${table.direction} in ('asc', 'desc')`),
    check(
      'tie_breakers_criterion_ck',
      sql`${table.criterion} in ('goal_difference', 'goals_scored', 'away_goals', 'wins', 'head_to_head_points', 'head_to_head_goal_difference', 'head_to_head_goals_scored', 'head_to_head_away_goals', 'fair_play', 'playoff_match', 'ranking_ruling')`,
    ),
  ],
)

export const fairPlayWeightSets = appSchema.table(
  'fair_play_weight_sets',
  {
    ...immutableRecordColumns(),
    rankingRuleSetId: uuid('ranking_rule_set_id')
      .notNull()
      .references(() => rankingRuleSets.id),
    yellowCardWeight: integer('yellow_card_weight').notNull(),
    secondYellowWeight: integer('second_yellow_weight').notNull(),
    directRedWeight: integer('direct_red_weight').notNull(),
  },
  (table) => [
    unique('fair_play_weight_sets_rule_uq').on(table.rankingRuleSetId),
    check(
      'fair_play_weight_sets_nonnegative_ck',
      sql`${table.yellowCardWeight} >= 0 and ${table.secondYellowWeight} >= 0 and ${table.directRedWeight} >= 0`,
    ),
  ],
)

export const crossGroupComparisonRules = appSchema.table(
  'cross_group_comparison_rules',
  {
    ...immutableRecordColumns(),
    rankingRuleSetId: uuid('ranking_rule_set_id')
      .notNull()
      .references(() => rankingRuleSets.id),
    method: text('method').notNull(),
    excludedLowestCount: integer('excluded_lowest_count'),
    validationHash: text('validation_hash').notNull(),
  },
  (table) => [
    unique('cross_group_comparison_rules_rule_uq').on(table.rankingRuleSetId),
    check(
      'cross_group_comparison_rules_method_ck',
      sql`${table.method} in ('all_matches', 'exclude_lowest', 'per_match_ratio')`,
    ),
    check(
      'cross_group_comparison_rules_exclusion_ck',
      sql`(${table.method} = 'exclude_lowest' and ${table.excludedLowestCount} > 0) or (${table.method} <> 'exclude_lowest' and ${table.excludedLowestCount} is null)`,
    ),
  ],
)

export const crossGroupTieBreakers = appSchema.table(
  'cross_group_tie_breakers',
  {
    ...immutableRecordColumns(),
    comparisonRuleId: uuid('comparison_rule_id')
      .notNull()
      .references(() => crossGroupComparisonRules.id),
    position: integer('position').notNull(),
    criterion: text('criterion').notNull(),
    direction: text('direction').notNull().default('desc'),
  },
  (table) => [
    unique('cross_group_tie_breakers_order_uq').on(table.comparisonRuleId, table.position),
    check('cross_group_tie_breakers_position_ck', sql`${table.position} > 0`),
    check('cross_group_tie_breakers_direction_ck', sql`${table.direction} in ('asc', 'desc')`),
  ],
)

export const qualificationSlots = appSchema.table(
  'qualification_slots',
  {
    ...mutableRecordColumns(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => competitionStages.id, { onDelete: 'restrict' }),
    knockoutRoundId: uuid('knockout_round_id').references((): AnyPgColumn => knockoutRounds.id),
    knockoutTieId: uuid('knockout_tie_id').references((): AnyPgColumn => knockoutTies.id),
    stableCode: text('stable_code').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    unique('qualification_slots_stage_code_uq').on(table.stageId, table.stableCode),
    check('qualification_slots_position_ck', sql`${table.position} > 0`),
  ],
)

export const qualificationRules = appSchema.table(
  'qualification_rules',
  {
    ...immutableRecordColumns(),
    rankingRuleSetId: uuid('ranking_rule_set_id')
      .notNull()
      .references(() => rankingRuleSets.id),
    sourceGroupId: uuid('source_group_id').references(() => stageGroups.id),
    comparisonRuleId: uuid('comparison_rule_id').references(() => crossGroupComparisonRules.id),
    rankFrom: integer('rank_from').notNull(),
    rankThrough: integer('rank_through').notNull(),
    destinationSlotId: uuid('destination_slot_id').references(() => qualificationSlots.id),
    destinationDrawPoolId: uuid('destination_draw_pool_id').references(
      (): AnyPgColumn => drawPools.id,
    ),
  },
  (table) => [
    check(
      'qualification_rules_rank_ck',
      sql`${table.rankFrom} > 0 and ${table.rankThrough} >= ${table.rankFrom}`,
    ),
    check(
      'qualification_rules_destination_ck',
      sql`(${table.destinationSlotId} is not null) <> (${table.destinationDrawPoolId} is not null)`,
    ),
  ],
)

export const qualificationOutputs = appSchema.table(
  'qualification_outputs',
  {
    ...immutableRecordColumns(),
    sourceFinalStandingsSnapshotId: uuid('source_final_standings_snapshot_id').references(
      (): AnyPgColumn => finalStandingsSnapshots.id,
    ),
    sourceFinalKnockoutSnapshotId: uuid('source_final_knockout_snapshot_id').references(
      (): AnyPgColumn => finalKnockoutSnapshots.id,
    ),
    destinationSlotId: uuid('destination_slot_id')
      .notNull()
      .references(() => qualificationSlots.id),
    outcomeKind: text('outcome_kind').notNull(),
    seasonEntryId: uuid('season_entry_id').references(() => seasonEntries.id, {
      onDelete: 'restrict',
    }),
    qualificationRulingId: uuid('qualification_ruling_id').references(
      (): AnyPgColumn => qualificationRulings.id,
    ),
    supersedesOutputId: uuid('supersedes_output_id').references(
      (): AnyPgColumn => qualificationOutputs.id,
    ),
  },
  (table) => [
    check(
      'qualification_outputs_source_ck',
      sql`(${table.sourceFinalStandingsSnapshotId} is not null) <> (${table.sourceFinalKnockoutSnapshotId} is not null)`,
    ),
    check('qualification_outputs_kind_ck', sql`${table.outcomeKind} in ('entry', 'vacant', 'bye')`),
    check(
      'qualification_outputs_entry_ck',
      sql`(${table.outcomeKind} = 'entry' and ${table.seasonEntryId} is not null) or (${table.outcomeKind} <> 'entry' and ${table.seasonEntryId} is null)`,
    ),
  ],
)

export const qualificationRulings = appSchema.table(
  'qualification_rulings',
  {
    ...immutableRecordColumns(),
    sourceSnapshotId: uuid('source_snapshot_id')
      .notNull()
      .references(() => finalStandingsSnapshots.id),
    calculatedSeasonEntryId: uuid('calculated_season_entry_id')
      .notNull()
      .references(() => seasonEntries.id, { onDelete: 'restrict' }),
    outcomeKind: text('outcome_kind').notNull(),
    replacementSeasonEntryId: uuid('replacement_season_entry_id').references(
      () => seasonEntries.id,
      { onDelete: 'restrict' },
    ),
    reason: text('reason').notNull(),
    actorId: uuid('actor_id').notNull(),
    supportingReferenceId: uuid('supporting_reference_id'), // Governance FK in #71/#72.
    supersedesRulingId: uuid('supersedes_ruling_id').references(
      (): AnyPgColumn => qualificationRulings.id,
    ),
  },
  (table) => [
    check(
      'qualification_rulings_kind_ck',
      sql`${table.outcomeKind} in ('replacement', 'vacant', 'bye')`,
    ),
    check(
      'qualification_rulings_replacement_ck',
      sql`(${table.outcomeKind} = 'replacement' and ${table.replacementSeasonEntryId} is not null) or (${table.outcomeKind} <> 'replacement' and ${table.replacementSeasonEntryId} is null)`,
    ),
  ],
)

export const rankingTieCases = appSchema.table(
  'ranking_tie_cases',
  {
    ...immutableRecordColumns(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => competitionStages.id, { onDelete: 'restrict' }),
    groupId: uuid('group_id').references(() => stageGroups.id),
    rankingRuleSetId: uuid('ranking_rule_set_id')
      .notNull()
      .references(() => rankingRuleSets.id),
    rankFrom: integer('rank_from').notNull(),
    rankThrough: integer('rank_through').notNull(),
    crossesQualificationBoundary: boolean('crosses_qualification_boundary').notNull(),
    inputHash: text('input_hash').notNull(),
    calculationHash: text('calculation_hash').notNull(),
    traceSchemaVersion: integer('trace_schema_version').notNull(),
    calculationTrace: jsonb('calculation_trace').notNull(),
  },
  (table) => [
    check(
      'ranking_tie_cases_rank_ck',
      sql`${table.rankFrom} > 0 and ${table.rankThrough} >= ${table.rankFrom}`,
    ),
    check('ranking_tie_cases_trace_version_ck', sql`${table.traceSchemaVersion} > 0`),
  ],
)

// Normalized participants; JSONB above is only a versioned calculation trace.
export const rankingTieCaseEntries = appSchema.table(
  'ranking_tie_case_entries',
  {
    ...immutableRecordColumns(),
    tieCaseId: uuid('tie_case_id')
      .notNull()
      .references(() => rankingTieCases.id),
    seasonEntryId: uuid('season_entry_id')
      .notNull()
      .references(() => seasonEntries.id, { onDelete: 'restrict' }),
    calculatedPosition: integer('calculated_position').notNull(),
  },
  (table) => [
    unique('ranking_tie_case_entries_entry_uq').on(table.tieCaseId, table.seasonEntryId),
    check('ranking_tie_case_entries_position_ck', sql`${table.calculatedPosition} > 0`),
  ],
)

export const rankingRulings = appSchema.table('ranking_rulings', {
  ...immutableRecordColumns(),
  tieCaseId: uuid('tie_case_id')
    .notNull()
    .references(() => rankingTieCases.id),
  reason: text('reason').notNull(),
  actorId: uuid('actor_id').notNull(),
  supportingReferenceId: uuid('supporting_reference_id'), // Governance FK in #71/#72.
  supersedesRulingId: uuid('supersedes_ruling_id').references((): AnyPgColumn => rankingRulings.id),
})

export const rankingRulingPositions = appSchema.table(
  'ranking_ruling_positions',
  {
    ...immutableRecordColumns(),
    rulingId: uuid('ruling_id')
      .notNull()
      .references(() => rankingRulings.id),
    seasonEntryId: uuid('season_entry_id')
      .notNull()
      .references(() => seasonEntries.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
  },
  (table) => [
    unique('ranking_ruling_positions_entry_uq').on(table.rulingId, table.seasonEntryId),
    unique('ranking_ruling_positions_position_uq').on(table.rulingId, table.position),
    check('ranking_ruling_positions_positive_ck', sql`${table.position} > 0`),
  ],
)

export const standingAdjustmentDecisions = appSchema.table(
  'standing_adjustment_decisions',
  {
    ...immutableRecordColumns(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => competitionStages.id, { onDelete: 'restrict' }),
    seasonEntryId: uuid('season_entry_id')
      .notNull()
      .references(() => seasonEntries.id, { onDelete: 'restrict' }),
    action: text('action').notNull(),
    pointsDelta: integer('points_delta'),
    effectiveOn: date('effective_on', { mode: 'string' }).notNull(),
    reason: text('reason').notNull(),
    actorId: uuid('actor_id').notNull(),
    supportingReferenceId: uuid('supporting_reference_id'), // Governance FK in #71/#72.
    supersedesDecisionId: uuid('supersedes_decision_id').references(
      (): AnyPgColumn => standingAdjustmentDecisions.id,
    ),
  },
  (table) => [
    check(
      'standing_adjustment_decisions_action_ck',
      sql`${table.action} in ('apply', 'revoke', 'replace')`,
    ),
    check(
      'standing_adjustment_decisions_delta_ck',
      sql`(${table.action} = 'revoke' and ${table.pointsDelta} is null) or (${table.action} <> 'revoke' and ${table.pointsDelta} is not null and ${table.pointsDelta} <> 0)`,
    ),
  ],
)

export const finalStandingsSnapshots = appSchema.table(
  'final_standings_snapshots',
  {
    ...immutableRecordColumns(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => competitionStages.id, { onDelete: 'restrict' }),
    stageVersionId: uuid('stage_version_id')
      .notNull()
      .references(() => competitionStageVersions.id, { onDelete: 'restrict' }),
    rankingRuleSetId: uuid('ranking_rule_set_id')
      .notNull()
      .references(() => rankingRuleSets.id),
    finalizationNumber: integer('finalization_number').notNull(),
    inputHash: text('input_hash').notNull(),
    actorId: uuid('actor_id').notNull(),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }).notNull(),
    supersedesSnapshotId: uuid('supersedes_snapshot_id').references(
      (): AnyPgColumn => finalStandingsSnapshots.id,
    ),
  },
  (table) => [
    unique('final_standings_snapshots_number_uq').on(table.stageId, table.finalizationNumber),
    check('final_standings_snapshots_number_ck', sql`${table.finalizationNumber} > 0`),
  ],
)

export const finalStandingsRows = appSchema.table(
  'final_standings_rows',
  {
    ...immutableRecordColumns(),
    snapshotId: uuid('snapshot_id')
      .notNull()
      .references(() => finalStandingsSnapshots.id),
    groupId: uuid('group_id').references(() => stageGroups.id),
    seasonEntryId: uuid('season_entry_id')
      .notNull()
      .references(() => seasonEntries.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    played: integer('played').notNull(),
    wins: integer('wins').notNull(),
    draws: integer('draws').notNull(),
    losses: integer('losses').notNull(),
    goalsFor: integer('goals_for').notNull(),
    goalsAgainst: integer('goals_against').notNull(),
    points: integer('points').notNull(),
  },
  (table) => [
    unique('final_standings_rows_entry_uq').on(table.snapshotId, table.seasonEntryId),
    index('final_standings_rows_position_idx').on(table.snapshotId, table.groupId, table.position),
    check('final_standings_rows_position_ck', sql`${table.position} > 0`),
    check(
      'final_standings_rows_totals_ck',
      sql`${table.played} >= 0 and ${table.wins} >= 0 and ${table.draws} >= 0 and ${table.losses} >= 0 and ${table.goalsFor} >= 0 and ${table.goalsAgainst} >= 0`,
    ),
  ],
)

export const finalStandingsEvidence = appSchema.table(
  'final_standings_evidence',
  {
    ...immutableRecordColumns(),
    snapshotId: uuid('snapshot_id')
      .notNull()
      .references(() => finalStandingsSnapshots.id),
    matchResultVersionId: uuid('match_result_version_id').references(() => matchResultVersions.id, {
      onDelete: 'restrict',
    }),
    disciplinarySummaryVersionId: uuid('disciplinary_summary_version_id').references(
      () => disciplinarySummaryVersions.id,
      { onDelete: 'restrict' },
    ),
    standingAdjustmentDecisionId: uuid('standing_adjustment_decision_id').references(
      () => standingAdjustmentDecisions.id,
    ),
    playoffMatchResultVersionId: uuid('playoff_match_result_version_id').references(
      () => matchResultVersions.id,
      { onDelete: 'restrict' },
    ),
    rankingRulingId: uuid('ranking_ruling_id').references(() => rankingRulings.id),
  },
  (table) => [
    check(
      'final_standings_evidence_one_source_ck',
      sql`num_nonnulls(${table.matchResultVersionId}, ${table.disciplinarySummaryVersionId}, ${table.standingAdjustmentDecisionId}, ${table.playoffMatchResultVersionId}, ${table.rankingRulingId}) = 1`,
    ),
  ],
)

export const knockoutRounds = appSchema.table(
  'knockout_rounds',
  {
    ...mutableRecordColumns(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => competitionStages.id, { onDelete: 'restrict' }),
    stableCode: text('stable_code').notNull(),
    currentVersionId: uuid('current_version_id').references(
      (): AnyPgColumn => knockoutRoundVersions.id,
    ),
  },
  (table) => [unique('knockout_rounds_stage_code_uq').on(table.stageId, table.stableCode)],
)

export const tieResolutionRuleSets = appSchema.table(
  'tie_resolution_rule_sets',
  {
    ...immutableRecordColumns(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => knockoutRounds.id),
    versionNumber: integer('version_number').notNull(),
    legCount: integer('leg_count').notNull(),
    validationHash: text('validation_hash').notNull(),
  },
  (table) => [
    unique('tie_resolution_rule_sets_round_number_uq').on(table.roundId, table.versionNumber),
    check('tie_resolution_rule_sets_number_ck', sql`${table.versionNumber} > 0`),
    check('tie_resolution_rule_sets_legs_ck', sql`${table.legCount} in (1, 2)`),
  ],
)

export const tieResolutionSteps = appSchema.table(
  'tie_resolution_steps',
  {
    ...immutableRecordColumns(),
    ruleSetId: uuid('rule_set_id')
      .notNull()
      .references(() => tieResolutionRuleSets.id),
    position: integer('position').notNull(),
    stepType: text('step_type').notNull(),
  },
  (table) => [
    unique('tie_resolution_steps_rule_position_uq').on(table.ruleSetId, table.position),
    check('tie_resolution_steps_position_ck', sql`${table.position} > 0`),
    check(
      'tie_resolution_steps_type_ck',
      sql`${table.stepType} in ('regulation', 'aggregate', 'extra_time', 'replay', 'penalties')`,
    ),
  ],
)

export const knockoutRoundVersions = appSchema.table(
  'knockout_round_versions',
  {
    ...immutableRecordColumns(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => knockoutRounds.id),
    stageVersionId: uuid('stage_version_id')
      .notNull()
      .references(() => competitionStageVersions.id, { onDelete: 'restrict' }),
    versionNumber: integer('version_number').notNull(),
    position: integer('position').notNull(),
    bracketMode: text('bracket_mode').notNull(),
    tieResolutionRuleSetId: uuid('tie_resolution_rule_set_id')
      .notNull()
      .references(() => tieResolutionRuleSets.id),
  },
  (table) => [
    unique('knockout_round_versions_number_uq').on(table.roundId, table.versionNumber),
    unique('knockout_round_versions_stage_position_uq').on(table.stageVersionId, table.position),
    check(
      'knockout_round_versions_number_position_ck',
      sql`${table.versionNumber} > 0 and ${table.position} > 0`,
    ),
    check(
      'knockout_round_versions_mode_ck',
      sql`${table.bracketMode} in ('fixed_bracket', 'redraw_each_round')`,
    ),
  ],
)

export const drawPools = appSchema.table(
  'draw_pools',
  {
    ...immutableRecordColumns(),
    roundVersionId: uuid('round_version_id')
      .notNull()
      .references(() => knockoutRoundVersions.id),
    code: text('code').notNull(),
    mode: text('mode').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    unique('draw_pools_round_code_uq').on(table.roundVersionId, table.code),
    unique('draw_pools_round_position_uq').on(table.roundVersionId, table.position),
    check('draw_pools_mode_ck', sql`${table.mode} in ('open', 'seeded')`),
    check('draw_pools_position_ck', sql`${table.position} > 0`),
  ],
)

export const drawPots = appSchema.table(
  'draw_pots',
  {
    ...immutableRecordColumns(),
    drawPoolId: uuid('draw_pool_id')
      .notNull()
      .references(() => drawPools.id),
    code: text('code').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    unique('draw_pots_pool_code_uq').on(table.drawPoolId, table.code),
    unique('draw_pots_pool_position_uq').on(table.drawPoolId, table.position),
    check('draw_pots_position_ck', sql`${table.position} > 0`),
  ],
)

export const drawPoolEntries = appSchema.table(
  'draw_pool_entries',
  {
    ...immutableRecordColumns(),
    drawPoolId: uuid('draw_pool_id')
      .notNull()
      .references(() => drawPools.id),
    seasonEntryId: uuid('season_entry_id').references(() => seasonEntries.id, {
      onDelete: 'restrict',
    }),
    sourceQualificationOutputId: uuid('source_qualification_output_id').references(
      () => qualificationOutputs.id,
    ),
    unresolvedSourceSlotId: uuid('unresolved_source_slot_id').references(
      () => stageParticipantSlots.id,
    ),
    potId: uuid('pot_id').references(() => drawPots.id),
    position: integer('position').notNull(),
  },
  (table) => [
    unique('draw_pool_entries_pool_position_uq').on(table.drawPoolId, table.position),
    check('draw_pool_entries_position_ck', sql`${table.position} > 0`),
    check(
      'draw_pool_entries_source_ck',
      sql`num_nonnulls(${table.seasonEntryId}, ${table.sourceQualificationOutputId}, ${table.unresolvedSourceSlotId}) = 1`,
    ),
  ],
)

export const drawConstraints = appSchema.table('draw_constraints', {
  ...immutableRecordColumns(),
  drawPoolId: uuid('draw_pool_id')
    .notNull()
    .references(() => drawPools.id),
  kind: text('kind').notNull(),
  sourcePotId: uuid('source_pot_id').references(() => drawPots.id),
  targetPotId: uuid('target_pot_id').references(() => drawPots.id),
  parameter: text('parameter'),
})

export const knockoutTies = appSchema.table(
  'knockout_ties',
  {
    ...mutableRecordColumns(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => knockoutRounds.id),
    stableCode: text('stable_code').notNull(),
    sportingState: text('sporting_state').notNull().default('configured'),
    currentVersionId: uuid('current_version_id').references(
      (): AnyPgColumn => knockoutTieVersions.id,
    ),
    currentRulingId: uuid('current_ruling_id').references((): AnyPgColumn => tieRulings.id),
    currentOutcomeId: uuid('current_outcome_id').references((): AnyPgColumn => tieOutcomes.id),
  },
  (table) => [
    unique('knockout_ties_round_code_uq').on(table.roundId, table.stableCode),
    check(
      'knockout_ties_state_ck',
      sql`${table.sportingState} in ('configured', 'ready', 'in_progress', 'awaiting_finalization', 'finalized', 'suspended')`,
    ),
  ],
)

export const knockoutTieParticipantSlots = appSchema.table(
  'knockout_tie_participant_slots',
  {
    ...mutableRecordColumns(),
    tieId: uuid('tie_id')
      .notNull()
      .references(() => knockoutTies.id),
    side: text('side').notNull(),
    expectedSourceKind: text('expected_source_kind').notNull(),
    sourceQualificationSlotId: uuid('source_qualification_slot_id').references(
      () => qualificationSlots.id,
    ),
    sourceStageParticipantSlotId: uuid('source_stage_participant_slot_id').references(
      () => stageParticipantSlots.id,
    ),
    currentSeasonEntryId: uuid('current_season_entry_id').references(() => seasonEntries.id, {
      onDelete: 'restrict',
    }),
    currentDrawAssignmentId: uuid('current_draw_assignment_id').references(
      (): AnyPgColumn => drawOutcomeAssignments.id,
    ),
  },
  (table) => [
    unique('knockout_tie_participant_slots_side_uq').on(table.tieId, table.side),
    check('knockout_tie_participant_slots_side_ck', sql`${table.side} in ('home', 'away')`),
    check(
      'knockout_tie_participant_slots_source_ck',
      sql`${table.expectedSourceKind} in ('direct_entry', 'qualification', 'stage_output', 'draw')`,
    ),
  ],
)

export const knockoutTieVersions = appSchema.table(
  'knockout_tie_versions',
  {
    ...immutableRecordColumns(),
    tieId: uuid('tie_id')
      .notNull()
      .references(() => knockoutTies.id),
    roundVersionId: uuid('round_version_id')
      .notNull()
      .references(() => knockoutRoundVersions.id),
    versionNumber: integer('version_number').notNull(),
    bracketPosition: integer('bracket_position').notNull(),
    placementKind: text('placement_kind'),
    homeSlotId: uuid('home_slot_id')
      .notNull()
      .references(() => knockoutTieParticipantSlots.id),
    awaySlotId: uuid('away_slot_id')
      .notNull()
      .references(() => knockoutTieParticipantSlots.id),
    winnerDestinationSlotId: uuid('winner_destination_slot_id').references(
      () => qualificationSlots.id,
    ),
    loserDestinationSlotId: uuid('loser_destination_slot_id').references(
      () => qualificationSlots.id,
    ),
  },
  (table) => [
    unique('knockout_tie_versions_number_uq').on(table.tieId, table.versionNumber),
    unique('knockout_tie_versions_bracket_position_uq').on(
      table.roundVersionId,
      table.bracketPosition,
    ),
    check(
      'knockout_tie_versions_position_ck',
      sql`${table.versionNumber} > 0 and ${table.bracketPosition} > 0`,
    ),
    check('knockout_tie_versions_slots_ck', sql`${table.homeSlotId} <> ${table.awaySlotId}`),
    check(
      'knockout_tie_versions_placement_ck',
      sql`${table.placementKind} is null or ${table.placementKind} in ('final', 'third_place')`,
    ),
  ],
)

export const tieStateTransitions = appSchema.table('tie_state_transitions', {
  ...immutableRecordColumns(),
  tieId: uuid('tie_id')
    .notNull()
    .references(() => knockoutTies.id),
  fromState: text('from_state').notNull(),
  toState: text('to_state').notNull(),
  reason: text('reason').notNull(),
  actorId: uuid('actor_id').notNull(),
  rulingId: uuid('ruling_id').references((): AnyPgColumn => tieRulings.id),
})

export const drawOutcomeDrafts = appSchema.table(
  'draw_outcome_drafts',
  {
    ...mutableRecordColumns(),
    roundId: uuid('round_id')
      .notNull()
      .references(() => knockoutRounds.id),
    roundVersionId: uuid('round_version_id')
      .notNull()
      .references(() => knockoutRoundVersions.id),
    externalDrawOn: date('external_draw_on', { mode: 'string' }),
    supportingReferenceId: uuid('supporting_reference_id'), // Governance FK in #71/#72.
    validationState: text('validation_state').notNull().default('unvalidated'),
    validationHash: text('validation_hash'),
    authorId: uuid('author_id').notNull(),
  },
  (table) => [unique('draw_outcome_drafts_round_uq').on(table.roundId)],
)

// Draft assignments are normalized so source and destination uniqueness can be validated.
export const drawOutcomeDraftAssignments = appSchema.table(
  'draw_outcome_draft_assignments',
  {
    ...mutableRecordColumns(),
    draftId: uuid('draft_id')
      .notNull()
      .references(() => drawOutcomeDrafts.id),
    drawPoolEntryId: uuid('draw_pool_entry_id').references(() => drawPoolEntries.id),
    unresolvedSourceSlotId: uuid('unresolved_source_slot_id').references(
      () => stageParticipantSlots.id,
    ),
    tieParticipantSlotId: uuid('tie_participant_slot_id')
      .notNull()
      .references(() => knockoutTieParticipantSlots.id),
  },
  (table) => [
    unique('draw_outcome_draft_assignments_dest_uq').on(table.draftId, table.tieParticipantSlotId),
    check(
      'draw_outcome_draft_assignments_source_ck',
      sql`(${table.drawPoolEntryId} is not null) <> (${table.unresolvedSourceSlotId} is not null)`,
    ),
  ],
)

export const drawOutcomes = appSchema.table('draw_outcomes', {
  ...immutableRecordColumns(),
  roundId: uuid('round_id')
    .notNull()
    .references(() => knockoutRounds.id),
  roundVersionId: uuid('round_version_id')
    .notNull()
    .references(() => knockoutRoundVersions.id),
  externalDrawOn: date('external_draw_on', { mode: 'string' }).notNull(),
  actorId: uuid('actor_id').notNull(),
  supportingReferenceId: uuid('supporting_reference_id'), // Governance FK in #71/#72.
  contentHash: text('content_hash').notNull(),
  supersedesOutcomeId: uuid('supersedes_outcome_id').references((): AnyPgColumn => drawOutcomes.id),
})

export const drawOutcomeAssignments = appSchema.table(
  'draw_outcome_assignments',
  {
    ...immutableRecordColumns(),
    drawOutcomeId: uuid('draw_outcome_id')
      .notNull()
      .references(() => drawOutcomes.id),
    drawPoolEntryId: uuid('draw_pool_entry_id').references(() => drawPoolEntries.id),
    unresolvedSourceSlotId: uuid('unresolved_source_slot_id').references(
      () => stageParticipantSlots.id,
    ),
    tieParticipantSlotId: uuid('tie_participant_slot_id')
      .notNull()
      .references(() => knockoutTieParticipantSlots.id),
  },
  (table) => [
    unique('draw_outcome_assignments_dest_uq').on(table.drawOutcomeId, table.tieParticipantSlotId),
    check(
      'draw_outcome_assignments_source_ck',
      sql`(${table.drawPoolEntryId} is not null) <> (${table.unresolvedSourceSlotId} is not null)`,
    ),
  ],
)

export const confirmedByes = appSchema.table(
  'confirmed_byes',
  {
    ...immutableRecordColumns(),
    sourceSlotId: uuid('source_slot_id')
      .notNull()
      .references(() => qualificationSlots.id),
    destinationSlotId: uuid('destination_slot_id')
      .notNull()
      .references(() => qualificationSlots.id),
    seasonEntryId: uuid('season_entry_id')
      .notNull()
      .references(() => seasonEntries.id, { onDelete: 'restrict' }),
    drawOutcomeId: uuid('draw_outcome_id').references(() => drawOutcomes.id),
    reason: text('reason').notNull(),
    actorId: uuid('actor_id').notNull(),
    supersedesByeId: uuid('supersedes_bye_id').references((): AnyPgColumn => confirmedByes.id),
  },
  (table) => [
    check(
      'confirmed_byes_distinct_slots_ck',
      sql`${table.sourceSlotId} <> ${table.destinationSlotId}`,
    ),
  ],
)

export const tieRulings = appSchema.table(
  'tie_rulings',
  {
    ...immutableRecordColumns(),
    tieId: uuid('tie_id')
      .notNull()
      .references(() => knockoutTies.id),
    action: text('action').notNull(),
    winnerSeasonEntryId: uuid('winner_season_entry_id').references(() => seasonEntries.id, {
      onDelete: 'restrict',
    }),
    reason: text('reason').notNull(),
    decidedOn: date('decided_on', { mode: 'string' }).notNull(),
    actorId: uuid('actor_id').notNull(),
    supportingReferenceId: uuid('supporting_reference_id'), // Governance FK in #71/#72.
    supersedesRulingId: uuid('supersedes_ruling_id').references((): AnyPgColumn => tieRulings.id),
  },
  (table) => [
    check('tie_rulings_action_ck', sql`${table.action} in ('assign', 'revise', 'revoke')`),
    check(
      'tie_rulings_winner_ck',
      sql`(${table.action} = 'revoke' and ${table.winnerSeasonEntryId} is null) or (${table.action} <> 'revoke' and ${table.winnerSeasonEntryId} is not null)`,
    ),
  ],
)

export const tieOutcomes = appSchema.table(
  'tie_outcomes',
  {
    ...immutableRecordColumns(),
    tieId: uuid('tie_id')
      .notNull()
      .references(() => knockoutTies.id),
    tieVersionId: uuid('tie_version_id')
      .notNull()
      .references(() => knockoutTieVersions.id),
    ruleSetId: uuid('rule_set_id')
      .notNull()
      .references(() => tieResolutionRuleSets.id),
    firstMatchResultVersionId: uuid('first_match_result_version_id').references(
      () => matchResultVersions.id,
      { onDelete: 'restrict' },
    ),
    secondLegResultVersionId: uuid('second_leg_result_version_id').references(
      () => matchResultVersions.id,
      { onDelete: 'restrict' },
    ),
    replayResultVersionId: uuid('replay_result_version_id').references(
      () => matchResultVersions.id,
      { onDelete: 'restrict' },
    ),
    decisiveShootoutVersionId: uuid('decisive_shootout_version_id').references(
      () => penaltyShootoutVersions.id,
      { onDelete: 'restrict' },
    ),
    tieRulingId: uuid('tie_ruling_id').references(() => tieRulings.id),
    aggregateHomeGoals: integer('aggregate_home_goals'),
    aggregateAwayGoals: integer('aggregate_away_goals'),
    winnerSeasonEntryId: uuid('winner_season_entry_id')
      .notNull()
      .references(() => seasonEntries.id, { onDelete: 'restrict' }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull(),
    actorId: uuid('actor_id').notNull(),
    supersedesOutcomeId: uuid('supersedes_outcome_id').references(
      (): AnyPgColumn => tieOutcomes.id,
    ),
  },
  (table) => [
    check(
      'tie_outcomes_aggregate_ck',
      sql`(${table.aggregateHomeGoals} is null and ${table.aggregateAwayGoals} is null) or (${table.aggregateHomeGoals} >= 0 and ${table.aggregateAwayGoals} >= 0)`,
    ),
    check(
      'tie_outcomes_evidence_ck',
      sql`num_nonnulls(${table.firstMatchResultVersionId}, ${table.secondLegResultVersionId}, ${table.replayResultVersionId}, ${table.tieRulingId}) > 0`,
    ),
  ],
)

export const placementOutputs = appSchema.table(
  'placement_outputs',
  {
    ...immutableRecordColumns(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => competitionStages.id, { onDelete: 'restrict' }),
    tieOutcomeId: uuid('tie_outcome_id')
      .notNull()
      .references(() => tieOutcomes.id),
    placementKind: text('placement_kind').notNull(),
    seasonEntryId: uuid('season_entry_id')
      .notNull()
      .references(() => seasonEntries.id, { onDelete: 'restrict' }),
  },
  (table) => [
    unique('placement_outputs_tie_kind_uq').on(table.tieOutcomeId, table.placementKind),
    check(
      'placement_outputs_kind_ck',
      sql`${table.placementKind} in ('champion', 'runner_up', 'third', 'fourth')`,
    ),
  ],
)

export const finalKnockoutSnapshots = appSchema.table(
  'final_knockout_snapshots',
  {
    ...immutableRecordColumns(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => competitionStages.id, { onDelete: 'restrict' }),
    stageVersionId: uuid('stage_version_id')
      .notNull()
      .references(() => competitionStageVersions.id, { onDelete: 'restrict' }),
    finalizationNumber: integer('finalization_number').notNull(),
    inputHash: text('input_hash').notNull(),
    actorId: uuid('actor_id').notNull(),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }).notNull(),
    supersedesSnapshotId: uuid('supersedes_snapshot_id').references(
      (): AnyPgColumn => finalKnockoutSnapshots.id,
    ),
  },
  (table) => [
    unique('final_knockout_snapshots_number_uq').on(table.stageId, table.finalizationNumber),
    check('final_knockout_snapshots_number_ck', sql`${table.finalizationNumber} > 0`),
  ],
)

export const finalKnockoutEvidence = appSchema.table(
  'final_knockout_evidence',
  {
    ...immutableRecordColumns(),
    snapshotId: uuid('snapshot_id')
      .notNull()
      .references(() => finalKnockoutSnapshots.id),
    tieVersionId: uuid('tie_version_id').references(() => knockoutTieVersions.id),
    tieOutcomeId: uuid('tie_outcome_id').references(() => tieOutcomes.id),
    drawOutcomeId: uuid('draw_outcome_id').references(() => drawOutcomes.id),
    confirmedByeId: uuid('confirmed_bye_id').references(() => confirmedByes.id),
    tieRulingId: uuid('tie_ruling_id').references(() => tieRulings.id),
    placementOutputId: uuid('placement_output_id').references(() => placementOutputs.id),
    qualificationOutputId: uuid('qualification_output_id').references(
      () => qualificationOutputs.id,
    ),
  },
  (table) => [
    check(
      'final_knockout_evidence_one_source_ck',
      sql`num_nonnulls(${table.tieVersionId}, ${table.tieOutcomeId}, ${table.drawOutcomeId}, ${table.confirmedByeId}, ${table.tieRulingId}, ${table.placementOutputId}, ${table.qualificationOutputId}) = 1`,
    ),
  ],
)
