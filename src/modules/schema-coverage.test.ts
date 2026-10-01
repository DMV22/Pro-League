import { getTableName } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'

import * as competition from './competition/infrastructure/schema'
import * as registration from './registration/infrastructure/schema'

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

describe('module-owned schema coverage', () => {
  it('accounts for every Competition blueprint table', () => {
    expect(Object.values(competition).map(getTableName).sort()).toEqual(competitionTables.sort())
  })

  it('accounts for every Registration blueprint table', () => {
    expect(Object.values(registration).map(getTableName).sort()).toEqual(registrationTables.sort())
  })

  it('resolves every table and declared constraint inside the app schema', () => {
    for (const table of [...Object.values(competition), ...Object.values(registration)]) {
      const configuration = getTableConfig(table)
      expect(configuration.schema).toBe('app')
      expect(configuration.columns.length).toBeGreaterThan(0)
    }
  })
})
