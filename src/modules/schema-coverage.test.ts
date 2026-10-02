import { getTableName } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'

import * as competition from './competition/infrastructure/schema'
import * as editorial from './editorial/infrastructure/schema'
import * as governance from './governance/infrastructure/schema'
import * as identityAccess from './identity-access/infrastructure/schema'
import * as match from './match/infrastructure/schema'
import * as media from './media/infrastructure/schema'
import * as operations from './operations/infrastructure/schema'
import * as registration from './registration/infrastructure/schema'
import * as standingsProgression from './standings-progression/infrastructure/schema'

const competitionTables = [
  'competitions',
  'competition_slugs',
  'competition_profile_versions',
  'seasons',
  'season_slugs',
  'season_state_transitions',
  'season_visibility_transitions',
  'season_archive_transitions',
  'current_season_designations',
  'competition_formats',
  'competition_format_drafts',
  'format_draft_stages',
  'format_draft_stage_groups',
  'format_draft_participant_slots',
  'format_draft_dependencies',
  'format_draft_ranking_rule_sets',
  'format_draft_points_schemes',
  'format_draft_tie_breakers',
  'format_draft_qualification_rules',
  'format_draft_draw_pools',
  'format_draft_draw_pots',
  'format_draft_draw_constraints',
  'format_draft_knockout_rounds',
  'format_draft_knockout_ties',
  'format_draft_tie_participant_slots',
  'format_draft_resolution_steps',
  'competition_format_versions',
  'competition_format_activations',
  'format_amendments',
  'format_amendment_transitions',
  'format_amendment_stages',
  'format_templates',
  'format_template_versions',
  'competition_stages',
  'competition_stage_versions',
  'stage_state_transitions',
  'stage_dependencies',
  'stage_groups',
  'stage_group_versions',
]

const registrationTables = [
  'teams',
  'team_profile_versions',
  'team_slugs',
  'players',
  'player_identity_versions',
  'player_private_details',
  'player_private_detail_versions',
  'player_merges',
  'player_publication_transitions',
  'player_publication_consents',
  'season_applications',
  'season_application_decisions',
  'application_checklist_templates',
  'application_checklist_template_items',
  'application_checklist_items',
  'season_entries',
  'season_entry_state_transitions',
  'registration_windows',
  'registration_window_transitions',
  'roster_rule_sets',
  'legionnaire_quota_versions',
  'season_rosters',
  'roster_readiness_decisions',
  'roster_entries',
  'roster_registration_periods',
  'roster_registration_period_revisions',
  'roster_entry_decisions',
  'legionnaire_classification_decisions',
  'roster_transfers',
  'roster_eligibility_rulings',
]

const matchTables = [
  'fixture_rounds',
  'fixture_slots',
  'league_fixture_slots',
  'knockout_fixture_slots',
  'playoff_fixture_slots',
  'replacement_fixture_slots',
  'rest_slots',
  'matches',
  'match_participant_assignments',
  'match_state_transitions',
  'match_visibility_transitions',
  'match_publication_batches',
  'match_publication_batch_items',
  'match_schedule_drafts',
  'match_schedule_revisions',
  'match_actual_kickoffs',
  'venues',
  'venue_profile_versions',
  'playing_fields',
  'match_participant_occupancies',
  'match_result_drafts',
  'played_score_versions',
  'penalty_shootout_versions',
  'result_rulings',
  'technical_results',
  'match_result_versions',
  'disciplinary_summary_versions',
  'match_replacements',
]

const standingsProgressionTables = [
  'stage_participant_slots',
  'stage_participant_assignments',
  'ranking_rule_sets',
  'points_schemes',
  'tie_breakers',
  'fair_play_weight_sets',
  'cross_group_comparison_rules',
  'cross_group_tie_breakers',
  'qualification_rules',
  'qualification_slots',
  'qualification_outputs',
  'qualification_rulings',
  'ranking_tie_cases',
  'ranking_tie_case_entries',
  'ranking_rulings',
  'ranking_ruling_positions',
  'standing_adjustment_decisions',
  'final_standings_snapshots',
  'final_standings_rows',
  'final_standings_evidence',
  'draw_pools',
  'draw_pool_entries',
  'draw_pots',
  'draw_constraints',
  'knockout_rounds',
  'knockout_round_versions',
  'tie_resolution_rule_sets',
  'tie_resolution_steps',
  'knockout_ties',
  'knockout_tie_versions',
  'knockout_tie_participant_slots',
  'tie_state_transitions',
  'draw_outcome_drafts',
  'draw_outcome_draft_assignments',
  'draw_outcomes',
  'draw_outcome_assignments',
  'confirmed_byes',
  'tie_rulings',
  'tie_outcomes',
  'placement_outputs',
  'final_knockout_snapshots',
  'final_knockout_evidence',
]

const editorialTables = [
  'news_articles',
  'article_slugs',
  'article_working_copies',
  'article_revisions',
  'article_state_transitions',
  'article_categories',
  'article_category_versions',
  'article_category_state_transitions',
  'article_competition_associations_working',
  'article_season_associations_working',
  'article_team_associations_working',
  'article_match_associations_working',
  'article_player_associations_working',
  'article_competition_associations_revision',
  'article_season_associations_revision',
  'article_team_associations_revision',
  'article_match_associations_revision',
  'article_player_associations_revision',
  'article_publication_schedules',
  'article_recovery_snapshots',
  'featured_article_decisions',
  'article_media_placements_working',
  'article_media_placements_revision',
]

const mediaTables = [
  'media_upload_intents',
  'media_assets',
  'media_asset_metadata_versions',
  'media_presentations',
  'media_asset_variants',
  'media_processing_attempts',
  'media_asset_state_transitions',
  'media_withdrawal_decisions',
  'media_storage_tombstones',
]

const identityAccessTables = [
  'admin_identities',
  'admin_external_identities',
  'admin_invitations',
  'admin_access_grants',
  'admin_access_state_transitions',
  'admin_sessions',
  'external_identity_events',
  'external_sync_operations',
  'reconciliation_items',
  'privileged_operation_records',
]

const governanceTables = [
  'audit_events',
  'audit_event_targets',
  'audit_event_changes',
  'security_event_contexts',
  'supporting_references',
  'private_documents',
  'private_document_versions',
  'private_document_upload_intents',
  'privacy_requests',
  'privacy_request_transitions',
  'privacy_request_items',
  'privacy_request_actions',
  'legal_holds',
  'legal_hold_targets',
  'retention_policies',
  'retention_candidates',
  'privacy_deletion_ledger',
]

const operationsTables = [
  'outbox_messages',
  'command_executions',
  'scheduled_jobs',
  'job_runs',
  'cache_invalidation_intents',
  'inbound_webhook_receipts',
  'notification_deliveries',
  'incident_records',
  'incident_state_transitions',
  'operational_alerts',
  'recovery_verifications',
  'restore_validations',
]

describe('module-owned schema coverage', () => {
  it('accounts for every Competition blueprint table', () => {
    expect(Object.values(competition).map(getTableName).sort()).toEqual(competitionTables.sort())
  })

  it('accounts for every Registration blueprint table', () => {
    expect(Object.values(registration).map(getTableName).sort()).toEqual(registrationTables.sort())
  })

  it('accounts for every Match blueprint table', () => {
    expect(Object.values(match).map(getTableName).sort()).toEqual(matchTables.sort())
  })

  it('accounts for every Standings and Progression blueprint table', () => {
    expect(Object.values(standingsProgression).map(getTableName).sort()).toEqual(
      standingsProgressionTables.sort(),
    )
  })

  it('accounts for every Editorial, Media, Access, Governance, and Operations table', () => {
    expect(Object.values(editorial).map(getTableName).sort()).toEqual(editorialTables.sort())
    expect(Object.values(media).map(getTableName).sort()).toEqual(mediaTables.sort())
    expect(Object.values(identityAccess).map(getTableName).sort()).toEqual(
      identityAccessTables.sort(),
    )
    expect(Object.values(governance).map(getTableName).sort()).toEqual(governanceTables.sort())
    expect(Object.values(operations).map(getTableName).sort()).toEqual(operationsTables.sort())
  })

  it('resolves every table and declared constraint inside the app schema', () => {
    for (const table of [
      ...Object.values(competition),
      ...Object.values(registration),
      ...Object.values(match),
      ...Object.values(standingsProgression),
      ...Object.values(editorial),
      ...Object.values(media),
      ...Object.values(identityAccess),
      ...Object.values(governance),
      ...Object.values(operations),
    ]) {
      const configuration = getTableConfig(table)
      expect(configuration.schema).toBe('app')
      expect(configuration.columns.length).toBeGreaterThan(0)
    }
  })

  it('separates public Media from Private Documents and guards authorization and audit', () => {
    const assetColumnNames = getTableConfig(media.mediaAssets).columns.map((column) => column.name)
    expect(assetColumnNames).not.toContain('private_document_id')
    const privateColumnNames = getTableConfig(governance.privateDocuments).columns.map(
      (column) => column.name,
    )
    expect(privateColumnNames).not.toContain('media_asset_id')

    const grantIndexes = getTableConfig(identityAccess.adminAccessGrants).indexes.map(
      (value) => value.config.name,
    )
    expect(grantIndexes).toContain('admin_access_grants_current_uq')
    const referenceChecks = getTableConfig(governance.supportingReferences).checks.map(
      (value) => value.name,
    )
    expect(referenceChecks).toContain('supporting_references_one_source_ck')
    const auditColumns = getTableConfig(governance.auditEvents).columns.map((column) => column.name)
    expect(auditColumns).not.toContain('session_token')
    expect(auditColumns).not.toContain('private_document_contents')
  })

  it('keeps Rest Slots separate from Matches and declares core result guards', () => {
    const restColumnNames = getTableConfig(match.restSlots).columns.map((column) => column.name)
    expect(restColumnNames).toContain('fixture_round_id')
    expect(restColumnNames).not.toContain('match_id')
    expect(restColumnNames).not.toContain('venue_id')

    const matchChecks = getTableConfig(match.matches).checks.map((constraint) => constraint.name)
    expect(matchChecks).toContain('matches_finished_result_ck')

    const resultChecks = getTableConfig(match.matchResultVersions).checks.map(
      (constraint) => constraint.name,
    )
    expect(resultChecks).toContain('match_result_versions_source_ck')
    expect(resultChecks).toContain('match_result_versions_shootout_ck')
  })

  it('declares typed qualification and final-evidence guards', () => {
    const qualificationChecks = getTableConfig(standingsProgression.qualificationRules).checks.map(
      (constraint) => constraint.name,
    )
    expect(qualificationChecks).toContain('qualification_rules_destination_ck')

    const standingsEvidenceChecks = getTableConfig(
      standingsProgression.finalStandingsEvidence,
    ).checks.map((constraint) => constraint.name)
    const knockoutEvidenceChecks = getTableConfig(
      standingsProgression.finalKnockoutEvidence,
    ).checks.map((constraint) => constraint.name)
    expect(standingsEvidenceChecks).toContain('final_standings_evidence_one_source_ck')
    expect(knockoutEvidenceChecks).toContain('final_knockout_evidence_one_source_ck')
  })
})
