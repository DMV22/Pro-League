import { sql } from 'drizzle-orm'
import {
  boolean,
  bigint,
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

import {
  competitionStageVersions,
  competitionStages,
} from '../../competition/infrastructure/schema'
import { seasonEntries } from '../../registration/infrastructure/schema'
import { immutableRecordColumns, mutableRecordColumns } from '../../../server/db/columns'
import { appSchema } from '../../../server/db/schema'

// The participant-overlap GiST exclusion and slot-specialization trigger belong to #72.
const timestampRange = customType<{ data: string }>({ dataType: () => 'tstzrange' })

export const fixtureRounds = appSchema.table(
  'fixture_rounds',
  {
    ...mutableRecordColumns(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => competitionStages.id, { onDelete: 'restrict' }),
    stageVersionId: uuid('stage_version_id')
      .notNull()
      .references(() => competitionStageVersions.id, { onDelete: 'restrict' }),
    code: text('code').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    unique('fixture_rounds_stage_code_uq').on(table.stageId, table.code),
    unique('fixture_rounds_stage_position_uq').on(table.stageId, table.position),
    check('fixture_rounds_position_ck', sql`${table.position} > 0`),
  ],
)

export const fixtureSlots = appSchema.table(
  'fixture_slots',
  {
    ...mutableRecordColumns(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => competitionStages.id, { onDelete: 'restrict' }),
    stageVersionId: uuid('stage_version_id')
      .notNull()
      .references(() => competitionStageVersions.id, { onDelete: 'restrict' }),
    slotType: text('slot_type').notNull(),
    stableCode: text('stable_code').notNull(),
  },
  (table) => [
    unique('fixture_slots_stage_code_uq').on(table.stageId, table.stableCode),
    check(
      'fixture_slots_type_ck',
      sql`${table.slotType} in ('league', 'knockout', 'playoff', 'replacement')`,
    ),
  ],
)

export const leagueFixtureSlots = appSchema.table(
  'league_fixture_slots',
  {
    ...immutableRecordColumns(),
    fixtureSlotId: uuid('fixture_slot_id')
      .notNull()
      .references(() => fixtureSlots.id),
    fixtureRoundId: uuid('fixture_round_id')
      .notNull()
      .references(() => fixtureRounds.id),
    homeStageParticipantSlotId: uuid('home_stage_participant_slot_id').notNull(), // Progression FK in #72.
    awayStageParticipantSlotId: uuid('away_stage_participant_slot_id').notNull(), // Progression FK in #72.
    position: integer('position').notNull(),
  },
  (table) => [
    unique('league_fixture_slots_slot_uq').on(table.fixtureSlotId),
    unique('league_fixture_slots_round_position_uq').on(table.fixtureRoundId, table.position),
    check('league_fixture_slots_position_ck', sql`${table.position} > 0`),
    check(
      'league_fixture_slots_distinct_participants_ck',
      sql`${table.homeStageParticipantSlotId} <> ${table.awayStageParticipantSlotId}`,
    ),
  ],
)

export const knockoutFixtureSlots = appSchema.table(
  'knockout_fixture_slots',
  {
    ...immutableRecordColumns(),
    fixtureSlotId: uuid('fixture_slot_id')
      .notNull()
      .references(() => fixtureSlots.id),
    tieId: uuid('tie_id').notNull(), // Progression FK in #72.
    matchRole: text('match_role').notNull(),
  },
  (table) => [
    unique('knockout_fixture_slots_slot_uq').on(table.fixtureSlotId),
    unique('knockout_fixture_slots_tie_role_uq').on(table.tieId, table.matchRole),
    check(
      'knockout_fixture_slots_role_ck',
      sql`${table.matchRole} in ('single', 'first_leg', 'second_leg', 'replay')`,
    ),
  ],
)

export const playoffFixtureSlots = appSchema.table(
  'playoff_fixture_slots',
  {
    ...immutableRecordColumns(),
    fixtureSlotId: uuid('fixture_slot_id')
      .notNull()
      .references(() => fixtureSlots.id),
    rankingTieCaseId: uuid('ranking_tie_case_id').notNull(), // Progression FK in #72.
  },
  (table) => [unique('playoff_fixture_slots_slot_uq').on(table.fixtureSlotId)],
)

export const replacementFixtureSlots = appSchema.table(
  'replacement_fixture_slots',
  {
    ...immutableRecordColumns(),
    fixtureSlotId: uuid('fixture_slot_id')
      .notNull()
      .references(() => fixtureSlots.id),
    originalMatchId: uuid('original_match_id')
      .notNull()
      .references((): AnyPgColumn => matches.id),
  },
  (table) => [unique('replacement_fixture_slots_slot_uq').on(table.fixtureSlotId)],
)

export const restSlots = appSchema.table(
  'rest_slots',
  {
    ...immutableRecordColumns(),
    fixtureRoundId: uuid('fixture_round_id')
      .notNull()
      .references(() => fixtureRounds.id),
    stageParticipantSlotId: uuid('stage_participant_slot_id').notNull(), // Progression FK in #72.
    position: integer('position').notNull(),
  },
  (table) => [
    unique('rest_slots_round_position_uq').on(table.fixtureRoundId, table.position),
    unique('rest_slots_round_participant_uq').on(
      table.fixtureRoundId,
      table.stageParticipantSlotId,
    ),
    check('rest_slots_position_ck', sql`${table.position} > 0`),
  ],
)

export const matches = appSchema.table(
  'matches',
  {
    ...mutableRecordColumns(),
    fixtureSlotId: uuid('fixture_slot_id')
      .notNull()
      .references(() => fixtureSlots.id, { onDelete: 'restrict' }),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => competitionStages.id, { onDelete: 'restrict' }),
    sportingState: text('sporting_state').notNull().default('unscheduled'),
    visibility: text('visibility').notNull().default('private'),
    calendarUid: text('calendar_uid').notNull(),
    currentHomeAssignmentId: uuid('current_home_assignment_id').references(
      (): AnyPgColumn => matchParticipantAssignments.id,
    ),
    currentAwayAssignmentId: uuid('current_away_assignment_id').references(
      (): AnyPgColumn => matchParticipantAssignments.id,
    ),
    currentScheduleRevisionId: uuid('current_schedule_revision_id').references(
      (): AnyPgColumn => matchScheduleRevisions.id,
    ),
    currentResultVersionId: uuid('current_result_version_id').references(
      (): AnyPgColumn => matchResultVersions.id,
    ),
    currentActualKickoffId: uuid('current_actual_kickoff_id').references(
      (): AnyPgColumn => matchActualKickoffs.id,
    ),
  },
  (table) => [
    unique('matches_fixture_slot_uq').on(table.fixtureSlotId),
    unique('matches_calendar_uid_uq').on(table.calendarUid),
    index('matches_stage_visibility_state_idx').on(
      table.stageId,
      table.visibility,
      table.sportingState,
    ),
    check(
      'matches_state_ck',
      sql`${table.sportingState} in ('unscheduled', 'scheduled', 'postponed', 'in_progress', 'suspended', 'finished', 'cancelled')`,
    ),
    check('matches_visibility_ck', sql`${table.visibility} in ('private', 'public')`),
    check(
      'matches_finished_result_ck',
      sql`(${table.sportingState} = 'finished') = (${table.currentResultVersionId} is not null)`,
    ),
    check(
      'matches_distinct_assignments_ck',
      sql`${table.currentHomeAssignmentId} is null or ${table.currentAwayAssignmentId} is null or ${table.currentHomeAssignmentId} <> ${table.currentAwayAssignmentId}`,
    ),
  ],
)

export const matchParticipantAssignments = appSchema.table(
  'match_participant_assignments',
  {
    ...immutableRecordColumns(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id),
    role: text('role').notNull(),
    seasonEntryId: uuid('season_entry_id')
      .notNull()
      .references(() => seasonEntries.id, { onDelete: 'restrict' }),
    sourceStageParticipantSlotId: uuid('source_stage_participant_slot_id'), // Progression FK in #72.
    reason: text('reason').notNull(),
    actorId: uuid('actor_id').notNull(),
    supersedesAssignmentId: uuid('supersedes_assignment_id').references(
      (): AnyPgColumn => matchParticipantAssignments.id,
    ),
  },
  (table) => [
    check('match_participant_assignments_role_ck', sql`${table.role} in ('home', 'away')`),
  ],
)

export const matchStateTransitions = appSchema.table('match_state_transitions', {
  ...immutableRecordColumns(),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id),
  fromState: text('from_state').notNull(),
  toState: text('to_state').notNull(),
  causeReferenceId: uuid('cause_reference_id'), // Governance FK in #71/#72.
  reason: text('reason').notNull(),
  actorId: uuid('actor_id').notNull(),
})

export const matchVisibilityTransitions = appSchema.table('match_visibility_transitions', {
  ...immutableRecordColumns(),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id),
  fromVisibility: text('from_visibility').notNull(),
  toVisibility: text('to_visibility').notNull(),
  publicationBatchId: uuid('publication_batch_id').references(
    (): AnyPgColumn => matchPublicationBatches.id,
  ),
  reason: text('reason').notNull(),
  actorId: uuid('actor_id').notNull(),
})

export const matchPublicationBatches = appSchema.table(
  'match_publication_batches',
  {
    ...immutableRecordColumns(),
    scopeKind: text('scope_kind').notNull(),
    scopeId: uuid('scope_id').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    actorId: uuid('actor_id').notNull(),
    auditEventId: uuid('audit_event_id'), // Governance FK in #71/#72.
  },
  (table) => [
    check(
      'match_publication_batches_scope_ck',
      sql`${table.scopeKind} in ('match', 'fixture_round', 'knockout_round', 'stage')`,
    ),
  ],
)

export const matchPublicationBatchItems = appSchema.table(
  'match_publication_batch_items',
  {
    ...immutableRecordColumns(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => matchPublicationBatches.id),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id),
    scheduleRevisionId: uuid('schedule_revision_id')
      .notNull()
      .references((): AnyPgColumn => matchScheduleRevisions.id),
  },
  (table) => [unique('match_publication_batch_items_match_uq').on(table.batchId, table.matchId)],
)

export const matchScheduleDrafts = appSchema.table(
  'match_schedule_drafts',
  {
    ...mutableRecordColumns(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id),
    kickoffOn: date('kickoff_on', { mode: 'string' }),
    kickoffAtLocal: time('kickoff_at_local'),
    timezone: text('timezone').notNull(),
    venueId: uuid('venue_id').references((): AnyPgColumn => venues.id),
    playingFieldId: uuid('playing_field_id').references((): AnyPgColumn => playingFields.id),
    venueDesignation: text('venue_designation').notNull().default('home'),
    expectedDurationMinutes: integer('expected_duration_minutes'),
    turnaroundMinutes: integer('turnaround_minutes'),
    expectedMatchVersion: bigint('expected_match_version', { mode: 'bigint' }).notNull(),
  },
  (table) => [
    unique('match_schedule_drafts_match_uq').on(table.matchId),
    check(
      'match_schedule_drafts_designation_ck',
      sql`${table.venueDesignation} in ('home', 'away', 'neutral')`,
    ),
    check(
      'match_schedule_drafts_duration_ck',
      sql`${table.expectedDurationMinutes} is null or ${table.expectedDurationMinutes} > 0`,
    ),
    check(
      'match_schedule_drafts_turnaround_ck',
      sql`${table.turnaroundMinutes} is null or ${table.turnaroundMinutes} >= 0`,
    ),
    check(
      'match_schedule_drafts_field_venue_ck',
      sql`${table.playingFieldId} is null or ${table.venueId} is not null`,
    ),
  ],
)

export const matchScheduleRevisions = appSchema.table(
  'match_schedule_revisions',
  {
    ...immutableRecordColumns(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id),
    previousRevisionId: uuid('previous_revision_id').references(
      (): AnyPgColumn => matchScheduleRevisions.id,
    ),
    kickoffOn: date('kickoff_on', { mode: 'string' }),
    kickoffAtLocal: time('kickoff_at_local'),
    timezone: text('timezone').notNull(),
    kickoffAtUtc: timestamp('kickoff_at_utc', { withTimezone: true }),
    venueId: uuid('venue_id').references((): AnyPgColumn => venues.id),
    playingFieldId: uuid('playing_field_id').references((): AnyPgColumn => playingFields.id),
    venueNameSnapshot: text('venue_name_snapshot'),
    venueAddressSnapshot: text('venue_address_snapshot'),
    playingFieldNameSnapshot: text('playing_field_name_snapshot'),
    venueDesignation: text('venue_designation').notNull(),
    homeAssignmentId: uuid('home_assignment_id').references(() => matchParticipantAssignments.id),
    awayAssignmentId: uuid('away_assignment_id').references(() => matchParticipantAssignments.id),
    expectedDurationMinutes: integer('expected_duration_minutes'),
    turnaroundMinutes: integer('turnaround_minutes'),
    internalReason: text('internal_reason').notNull(),
    publicExplanation: text('public_explanation'),
    actorId: uuid('actor_id').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('match_schedule_revisions_match_time_idx').on(table.matchId, table.publishedAt),
    check(
      'match_schedule_revisions_designation_ck',
      sql`${table.venueDesignation} in ('home', 'away', 'neutral')`,
    ),
    check(
      'match_schedule_revisions_kickoff_ck',
      sql`(${table.kickoffAtUtc} is not null) = (${table.kickoffOn} is not null and ${table.kickoffAtLocal} is not null)`,
    ),
    check(
      'match_schedule_revisions_field_venue_ck',
      sql`${table.playingFieldId} is null or ${table.venueId} is not null`,
    ),
  ],
)

export const matchActualKickoffs = appSchema.table('match_actual_kickoffs', {
  ...immutableRecordColumns(),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id),
  actualKickoffAt: timestamp('actual_kickoff_at', { withTimezone: true }).notNull(),
  correctionReason: text('correction_reason'),
  actorId: uuid('actor_id').notNull(),
  supersedesKickoffId: uuid('supersedes_kickoff_id').references(
    (): AnyPgColumn => matchActualKickoffs.id,
  ),
})

export const venues = appSchema.table(
  'venues',
  {
    ...mutableRecordColumns(),
    currentProfileVersionId: uuid('current_profile_version_id').references(
      (): AnyPgColumn => venueProfileVersions.id,
    ),
    name: text('name').notNull(),
    locality: text('locality'),
    address: text('address'),
    latitude: text('latitude'),
    longitude: text('longitude'),
    visibility: text('visibility').notNull().default('private'),
    archiveState: text('archive_state').notNull().default('active'),
  },
  (table) => [
    check('venues_visibility_ck', sql`${table.visibility} in ('private', 'public')`),
    check('venues_archive_state_ck', sql`${table.archiveState} in ('active', 'archived')`),
  ],
)

export const venueProfileVersions = appSchema.table('venue_profile_versions', {
  ...immutableRecordColumns(),
  venueId: uuid('venue_id')
    .notNull()
    .references(() => venues.id),
  name: text('name').notNull(),
  locality: text('locality'),
  address: text('address'),
  latitude: text('latitude'),
  longitude: text('longitude'),
  correctionReason: text('correction_reason'),
  authorId: uuid('author_id').notNull(),
})

export const playingFields = appSchema.table(
  'playing_fields',
  {
    ...mutableRecordColumns(),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id),
    name: text('name').notNull(),
    code: text('code').notNull(),
    defaultDurationMinutes: integer('default_duration_minutes'),
    defaultTurnaroundMinutes: integer('default_turnaround_minutes'),
    isDefault: boolean('is_default').notNull().default(false),
    archiveState: text('archive_state').notNull().default('active'),
  },
  (table) => [
    unique('playing_fields_venue_code_uq').on(table.venueId, table.code),
    uniqueIndex('playing_fields_default_per_venue_uq')
      .on(table.venueId)
      .where(sql`${table.isDefault}`),
    check(
      'playing_fields_duration_ck',
      sql`${table.defaultDurationMinutes} is null or ${table.defaultDurationMinutes} > 0`,
    ),
    check(
      'playing_fields_turnaround_ck',
      sql`${table.defaultTurnaroundMinutes} is null or ${table.defaultTurnaroundMinutes} >= 0`,
    ),
    check('playing_fields_archive_ck', sql`${table.archiveState} in ('active', 'archived')`),
  ],
)

export const matchParticipantOccupancies = appSchema.table(
  'match_participant_occupancies',
  {
    ...mutableRecordColumns(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id),
    seasonEntryId: uuid('season_entry_id')
      .notNull()
      .references(() => seasonEntries.id, { onDelete: 'restrict' }),
    scheduleRevisionId: uuid('schedule_revision_id')
      .notNull()
      .references(() => matchScheduleRevisions.id),
    plannedPeriod: timestampRange('planned_period').notNull(),
  },
  (table) => [
    unique('match_participant_occupancies_match_entry_uq').on(table.matchId, table.seasonEntryId),
    index('match_participant_occupancies_entry_idx').on(table.seasonEntryId),
    check(
      'match_participant_occupancies_period_ck',
      sql`not isempty(${table.plannedPeriod}) and lower_inc(${table.plannedPeriod}) and not upper_inc(${table.plannedPeriod})`,
    ),
  ],
)

export const matchResultDrafts = appSchema.table(
  'match_result_drafts',
  {
    ...mutableRecordColumns(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id),
    proposedSource: text('proposed_source').notNull(),
    homeRegulationGoals: integer('home_regulation_goals'),
    awayRegulationGoals: integer('away_regulation_goals'),
    homeExtraTimeGoals: integer('home_extra_time_goals'),
    awayExtraTimeGoals: integer('away_extra_time_goals'),
    homePenaltyKicks: integer('home_penalty_kicks'),
    awayPenaltyKicks: integer('away_penalty_kicks'),
    proposedTechnicalHomeGoals: integer('proposed_technical_home_goals'),
    proposedTechnicalAwayGoals: integer('proposed_technical_away_goals'),
    technicalRulingId: uuid('technical_ruling_id').references((): AnyPgColumn => resultRulings.id),
    validationState: text('validation_state').notNull().default('unvalidated'),
  },
  (table) => [
    unique('match_result_drafts_match_uq').on(table.matchId),
    check('match_result_drafts_source_ck', sql`${table.proposedSource} in ('played', 'technical')`),
    check(
      'match_result_drafts_goals_ck',
      sql`coalesce(${table.homeRegulationGoals}, 0) >= 0 and coalesce(${table.awayRegulationGoals}, 0) >= 0 and coalesce(${table.homeExtraTimeGoals}, 0) >= 0 and coalesce(${table.awayExtraTimeGoals}, 0) >= 0 and coalesce(${table.homePenaltyKicks}, 0) >= 0 and coalesce(${table.awayPenaltyKicks}, 0) >= 0`,
    ),
    check(
      'match_result_drafts_technical_goals_ck',
      sql`coalesce(${table.proposedTechnicalHomeGoals}, 0) >= 0 and coalesce(${table.proposedTechnicalAwayGoals}, 0) >= 0`,
    ),
  ],
)

export const playedScoreVersions = appSchema.table(
  'played_score_versions',
  {
    ...immutableRecordColumns(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id),
    homeRegulationGoals: integer('home_regulation_goals').notNull(),
    awayRegulationGoals: integer('away_regulation_goals').notNull(),
    homeExtraTimeGoals: integer('home_extra_time_goals'),
    awayExtraTimeGoals: integer('away_extra_time_goals'),
    correctionReason: text('correction_reason'),
    actorId: uuid('actor_id').notNull(),
    supersedesScoreId: uuid('supersedes_score_id').references(
      (): AnyPgColumn => playedScoreVersions.id,
    ),
  },
  (table) => [
    check(
      'played_score_versions_regulation_ck',
      sql`${table.homeRegulationGoals} >= 0 and ${table.awayRegulationGoals} >= 0`,
    ),
    check(
      'played_score_versions_extra_time_ck',
      sql`(${table.homeExtraTimeGoals} is null and ${table.awayExtraTimeGoals} is null) or (${table.homeExtraTimeGoals} >= 0 and ${table.awayExtraTimeGoals} >= 0)`,
    ),
  ],
)

export const penaltyShootoutVersions = appSchema.table(
  'penalty_shootout_versions',
  {
    ...immutableRecordColumns(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id),
    homeSuccessfulKicks: integer('home_successful_kicks').notNull(),
    awaySuccessfulKicks: integer('away_successful_kicks').notNull(),
    winnerSeasonEntryId: uuid('winner_season_entry_id')
      .notNull()
      .references(() => seasonEntries.id, { onDelete: 'restrict' }),
    correctionReason: text('correction_reason'),
    actorId: uuid('actor_id').notNull(),
    supersedesShootoutId: uuid('supersedes_shootout_id').references(
      (): AnyPgColumn => penaltyShootoutVersions.id,
    ),
  },
  (table) => [
    check(
      'penalty_shootout_versions_kicks_ck',
      sql`${table.homeSuccessfulKicks} >= 0 and ${table.awaySuccessfulKicks} >= 0 and ${table.homeSuccessfulKicks} <> ${table.awaySuccessfulKicks}`,
    ),
  ],
)

export const resultRulings = appSchema.table(
  'result_rulings',
  {
    ...immutableRecordColumns(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id),
    action: text('action').notNull(),
    reason: text('reason').notNull(),
    decidedOn: date('decided_on', { mode: 'string' }).notNull(),
    actorId: uuid('actor_id').notNull(),
    supportingReferenceId: uuid('supporting_reference_id'), // Governance FK in #71/#72.
    supersedesRulingId: uuid('supersedes_ruling_id').references(
      (): AnyPgColumn => resultRulings.id,
    ),
  },
  (table) => [
    check('result_rulings_action_ck', sql`${table.action} in ('assign', 'revise', 'revoke')`),
  ],
)

export const technicalResults = appSchema.table(
  'technical_results',
  {
    ...immutableRecordColumns(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id),
    rulingId: uuid('ruling_id')
      .notNull()
      .references(() => resultRulings.id),
    homeGoals: integer('home_goals').notNull(),
    awayGoals: integer('away_goals').notNull(),
  },
  (table) => [
    unique('technical_results_ruling_uq').on(table.rulingId),
    check('technical_results_goals_ck', sql`${table.homeGoals} >= 0 and ${table.awayGoals} >= 0`),
  ],
)

export const matchResultVersions = appSchema.table(
  'match_result_versions',
  {
    ...immutableRecordColumns(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id),
    versionNumber: integer('version_number').notNull(),
    playedScoreVersionId: uuid('played_score_version_id').references(() => playedScoreVersions.id),
    technicalResultId: uuid('technical_result_id').references(() => technicalResults.id),
    penaltyShootoutVersionId: uuid('penalty_shootout_version_id').references(
      () => penaltyShootoutVersions.id,
    ),
    homeAssignmentId: uuid('home_assignment_id')
      .notNull()
      .references(() => matchParticipantAssignments.id),
    awayAssignmentId: uuid('away_assignment_id')
      .notNull()
      .references(() => matchParticipantAssignments.id),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull(),
    confirmedByActorId: uuid('confirmed_by_actor_id').notNull(),
    supersedesResultId: uuid('supersedes_result_id').references(
      (): AnyPgColumn => matchResultVersions.id,
    ),
  },
  (table) => [
    unique('match_result_versions_number_uq').on(table.matchId, table.versionNumber),
    check('match_result_versions_number_ck', sql`${table.versionNumber} > 0`),
    check(
      'match_result_versions_source_ck',
      sql`(${table.playedScoreVersionId} is not null) <> (${table.technicalResultId} is not null)`,
    ),
    check(
      'match_result_versions_shootout_ck',
      sql`${table.penaltyShootoutVersionId} is null or (${table.playedScoreVersionId} is not null and ${table.technicalResultId} is null)`,
    ),
    check(
      'match_result_versions_distinct_assignments_ck',
      sql`${table.homeAssignmentId} <> ${table.awayAssignmentId}`,
    ),
  ],
)

export const disciplinarySummaryVersions = appSchema.table(
  'disciplinary_summary_versions',
  {
    ...immutableRecordColumns(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id),
    seasonEntryId: uuid('season_entry_id')
      .notNull()
      .references(() => seasonEntries.id, { onDelete: 'restrict' }),
    yellowCards: integer('yellow_cards').notNull(),
    secondYellowDismissals: integer('second_yellow_dismissals').notNull(),
    directRedCards: integer('direct_red_cards').notNull(),
    correctionReason: text('correction_reason'),
    actorId: uuid('actor_id').notNull(),
    supersedesSummaryId: uuid('supersedes_summary_id').references(
      (): AnyPgColumn => disciplinarySummaryVersions.id,
    ),
  },
  (table) => [
    check(
      'disciplinary_summary_versions_counts_ck',
      sql`${table.yellowCards} >= 0 and ${table.secondYellowDismissals} >= 0 and ${table.directRedCards} >= 0`,
    ),
  ],
)

export const matchReplacements = appSchema.table(
  'match_replacements',
  {
    ...immutableRecordColumns(),
    originalMatchId: uuid('original_match_id')
      .notNull()
      .references(() => matches.id),
    replacementMatchId: uuid('replacement_match_id')
      .notNull()
      .references(() => matches.id),
    reason: text('reason').notNull(),
    actorId: uuid('actor_id').notNull(),
    supersedesReplacementId: uuid('supersedes_replacement_id').references(
      (): AnyPgColumn => matchReplacements.id,
    ),
  },
  (table) => [
    unique('match_replacements_replacement_uq').on(table.replacementMatchId),
    check(
      'match_replacements_distinct_ck',
      sql`${table.originalMatchId} <> ${table.replacementMatchId}`,
    ),
  ],
)
