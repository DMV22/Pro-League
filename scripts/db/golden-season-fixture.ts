import { createHash } from 'node:crypto'

import type pg from 'pg'

// Fixed UUIDv7-shaped identifiers make fixtures addressable across clean databases.
// These identities and names are fictional and never derived from Production data.
export function goldenId(key: string): string {
  const hash = createHash('sha256').update(`proleague-golden-season/v1/${key}`).digest('hex')
  return `0199a800-${hash.slice(0, 4)}-7${hash.slice(4, 7)}-8${hash.slice(7, 10)}-${hash.slice(10, 22)}`
}

const fixedTime = '2026-03-01T09:00:00.000Z'
const actorId = goldenId('fictional-admin')
const identifier = /^[a-z_][a-z_0-9]*$/

type Row = Record<string, string | number | boolean | null | object>

function quoted(value: string): string {
  if (!identifier.test(value)) throw new Error(`Unsafe fixture identifier: ${value}`)
  return `"${value}"`
}

async function add(client: pg.PoolClient, table: string, key: string, row: Row): Promise<string> {
  const id = goldenId(key)
  const values = { id, ...row }
  const columns = Object.keys(values)
  const parameters = Object.values(values).map((value) =>
    value !== null && typeof value === 'object' ? JSON.stringify(value) : value,
  )
  await client.query(
    `insert into app.${quoted(table)} (${columns.map(quoted).join(', ')}) values (${columns.map((_, index) => `$${index + 1}`).join(', ')})`,
    parameters,
  )
  return id
}

async function set(client: pg.PoolClient, table: string, key: string, row: Row): Promise<void> {
  const columns = Object.keys(row)
  await client.query(
    `update app.${quoted(table)} set ${columns.map((column, index) => `${quoted(column)} = $${index + 1}`).join(', ')} where id = $${columns.length + 1}`,
    [...Object.values(row), goldenId(key)],
  )
}

export async function seedGoldenSeason(client: pg.PoolClient): Promise<void> {
  const competition = await add(client, 'competitions', 'competition', {
    display_name: 'Вигаданий кубок громад',
    description: 'Синтетичний Golden Season; неофіційні демонстраційні дані.',
    visibility: 'public',
  })
  const season = await add(client, 'seasons', 'season', {
    competition_id: competition,
    name: 'Golden Season 2026',
    timezone: 'Europe/Kyiv',
    starts_on: '2026-03-01',
    ends_on: '2026-11-30',
    sporting_state: 'active',
    visibility: 'public',
  })
  const competitionSlug = await add(client, 'competition_slugs', 'competition-slug', {
    competition_id: competition,
    display_slug: 'golden-cup',
    normalized_slug: 'golden-cup',
    valid_from_at: fixedTime,
  })
  const seasonSlug = await add(client, 'season_slugs', 'season-slug', {
    competition_id: competition,
    season_id: season,
    display_slug: '2026-golden',
    normalized_slug: '2026-golden',
    valid_from_at: fixedTime,
  })
  await set(client, 'competitions', 'competition', {
    current_slug_id: competitionSlug,
    current_season_id: season,
  })
  await set(client, 'seasons', 'season', { current_slug_id: seasonSlug })

  const format = await add(client, 'competition_formats', 'format', { season_id: season })
  const formatDraft = await add(client, 'competition_format_drafts', 'format-draft', {
    format_id: format,
    editing_context: 'golden-season-v1',
    validation_state: 'valid',
    validation_hash: 'golden-season-format-v1',
  })
  const formatVersion = await add(client, 'competition_format_versions', 'format-version', {
    format_id: format,
    season_id: season,
    version_number: 1,
    content_hash: 'golden-season-format-v1',
    source_draft_id: formatDraft,
    author_id: actorId,
  })
  await set(client, 'seasons', 'season', { current_format_version_id: formatVersion })

  const teamNames = ['Берест', 'Луг', 'Явір', 'Сокіл'] as const
  const entries: string[] = []
  for (const [index, name] of teamNames.entries()) {
    const team = await add(client, 'teams', `team-${index}`, {
      display_name: `ФК ${name} (демо)`,
      locality: `Вигадане село ${name}`,
      visibility: 'public',
    })
    const application = await add(client, 'season_applications', `application-${index}`, {
      season_id: season,
      team_id: team,
      state: 'approved',
      submitted_on: '2026-02-15',
    })
    const entry = await add(client, 'season_entries', `entry-${index}`, {
      season_id: season,
      team_id: team,
      approved_application_id: application,
    })
    entries.push(entry)
  }

  const stageDefinitions = [
    ['league', 'Ліга', 'league', null],
    ['groups', 'Груповий етап', 'league', 'groups'],
    ['fixed', 'Плей-оф: фіксована сітка', 'knockout', null],
    ['redraw', 'Кубок: жеребкування етапів', 'knockout', null],
  ] as const
  const stages = new Map<string, { id: string; version: string }>()
  for (const [index, [code, name, type, grouping]] of stageDefinitions.entries()) {
    const stage = await add(client, 'competition_stages', `stage-${code}`, {
      season_id: season,
      code,
      sporting_state: 'active',
    })
    const version = await add(client, 'competition_stage_versions', `stage-version-${code}`, {
      stage_id: stage,
      format_version_id: formatVersion,
      name,
      position: index + 1,
      format_type: type,
      grouping_mode: grouping,
      configuration_hash: `golden-${code}-v1`,
    })
    await set(client, 'competition_stages', `stage-${code}`, { current_version_id: version })
    stages.set(code, { id: stage, version })
  }

  const league = stages.get('league')!
  const groups = stages.get('groups')!
  const fixed = stages.get('fixed')!
  const redraw = stages.get('redraw')!
  const leagueSlots: string[] = []
  for (let index = 0; index < 3; index++) {
    const slot = await add(client, 'stage_participant_slots', `league-slot-${index}`, {
      stage_id: league.id,
      stage_version_id: league.version,
      stable_code: `L${index + 1}`,
      position: index + 1,
      expected_source_kind: 'direct_entry',
    })
    const assignment = await add(
      client,
      'stage_participant_assignments',
      `league-assignment-${index}`,
      {
        slot_id: slot,
        season_entry_id: entries[index],
        reason: 'Вигадана заявка Golden Season',
        actor_id: actorId,
      },
    )
    await set(client, 'stage_participant_slots', `league-slot-${index}`, {
      current_assignment_id: assignment,
    })
    leagueSlots.push(slot)
  }

  for (const [index, code] of ['A', 'B'].entries()) {
    const group = await add(client, 'stage_groups', `group-${code}`, {
      stage_id: groups.id,
      stable_code: code,
    })
    await add(client, 'stage_group_versions', `group-version-${code}`, {
      stage_version_id: groups.version,
      group_id: group,
      name: `Група ${code}`,
      code,
      position: index + 1,
    })
  }
  const ranking = await add(client, 'ranking_rule_sets', 'ranking-league', {
    stage_version_id: league.version,
    validation_hash: 'golden-league-ranking-v1',
  })
  await add(client, 'points_schemes', 'league-points', {
    ranking_rule_set_id: ranking,
    win_points: 3,
    draw_points: 1,
    loss_points: 0,
  })
  for (const [index, criterion] of ['goal_difference', 'goals_scored', 'wins'].entries()) {
    await add(client, 'tie_breakers', `league-tiebreaker-${index}`, {
      ranking_rule_set_id: ranking,
      position: index + 1,
      criterion,
    })
  }

  await seedGroups(client, { entries, groups, fixed })
  await seedMatches(client, { season, entries, league, leagueSlots, fixed, redraw })
  await seedRosters(client, { season, entries })
  await seedEditorial(client, { competition, season })
  await seedOperations(client, { competition, season })
}

type Core = {
  season: string
  entries: string[]
  league: { id: string; version: string }
  leagueSlots: string[]
  fixed: { id: string; version: string }
  redraw: { id: string; version: string }
}

async function seedGroups(
  client: pg.PoolClient,
  core: {
    entries: string[]
    groups: { id: string; version: string }
    fixed: { id: string; version: string }
  },
): Promise<void> {
  const ranking = await add(client, 'ranking_rule_sets', 'ranking-groups', {
    stage_version_id: core.groups.version,
    validation_hash: 'golden-groups-ranking-v1',
  })
  await add(client, 'points_schemes', 'groups-points', { ranking_rule_set_id: ranking })
  await add(client, 'tie_breakers', 'groups-tiebreaker', {
    ranking_rule_set_id: ranking,
    position: 1,
    criterion: 'goal_difference',
  })
  const snapshot = await add(client, 'final_standings_snapshots', 'groups-snapshot', {
    stage_id: core.groups.id,
    stage_version_id: core.groups.version,
    ranking_rule_set_id: ranking,
    finalization_number: 1,
    input_hash: 'golden-groups-results-v1',
    actor_id: actorId,
    finalized_at: '2026-05-01T12:00:00Z',
  })
  for (const [groupIndex, code] of ['A', 'B'].entries()) {
    const participantSlots: string[] = []
    for (let side = 0; side < 2; side++) {
      const index = groupIndex * 2 + side
      const slot = await add(client, 'stage_participant_slots', `group-slot-${index}`, {
        stage_id: core.groups.id,
        stage_version_id: core.groups.version,
        stable_code: `${code}${side + 1}`,
        position: index + 1,
        expected_source_kind: 'direct_entry',
      })
      const assignment = await add(
        client,
        'stage_participant_assignments',
        `group-assignment-${index}`,
        {
          slot_id: slot,
          season_entry_id: core.entries[index],
          reason: 'Вигадане розміщення у групі',
          actor_id: actorId,
        },
      )
      await set(client, 'stage_participant_slots', `group-slot-${index}`, {
        current_assignment_id: assignment,
      })
      participantSlots.push(slot)
      await add(client, 'final_standings_rows', `group-standings-${index}`, {
        snapshot_id: snapshot,
        group_id: goldenId(`group-${code}`),
        season_entry_id: core.entries[index],
        position: side + 1,
        played: 1,
        wins: side === 0 ? 1 : 0,
        draws: 0,
        losses: side === 0 ? 0 : 1,
        goals_for: side === 0 ? groupIndex + 1 : 0,
        goals_against: side === 0 ? 0 : groupIndex + 1,
        points: side === 0 ? 3 : 0,
      })
      const destination = await add(client, 'qualification_slots', `fixed-qualification-${index}`, {
        stage_id: core.fixed.id,
        stable_code: `SF-${code}-${side + 1}`,
        position: index + 1,
      })
      await add(client, 'qualification_rules', `group-qualification-rule-${index}`, {
        ranking_rule_set_id: ranking,
        source_group_id: goldenId(`group-${code}`),
        rank_from: side + 1,
        rank_through: side + 1,
        destination_slot_id: destination,
      })
      await add(client, 'qualification_outputs', `group-qualification-output-${index}`, {
        source_final_standings_snapshot_id: snapshot,
        destination_slot_id: destination,
        outcome_kind: 'entry',
        season_entry_id: core.entries[index],
      })
    }
    const fixtureRound = await add(client, 'fixture_rounds', `group-round-${code}`, {
      stage_id: core.groups.id,
      stage_version_id: core.groups.version,
      code: `GROUP-${code}`,
      position: groupIndex + 1,
    })
    const fixture = await add(client, 'fixture_slots', `group-fixture-${code}`, {
      stage_id: core.groups.id,
      stage_version_id: core.groups.version,
      slot_type: 'league',
      stable_code: `GROUP-${code}-M1`,
    })
    await add(client, 'league_fixture_slots', `group-fixture-detail-${code}`, {
      fixture_slot_id: fixture,
      fixture_round_id: fixtureRound,
      home_stage_participant_slot_id: participantSlots[0],
      away_stage_participant_slot_id: participantSlots[1],
      position: 1,
    })
    const match = await add(client, 'matches', `group-match-${code}`, {
      fixture_slot_id: fixture,
      stage_id: core.groups.id,
      sporting_state: 'scheduled',
      visibility: 'public',
      calendar_uid: `golden-group-${code}@example.invalid`,
    })
    const assignments: string[] = []
    for (let side = 0; side < 2; side++) {
      assignments.push(
        await add(
          client,
          'match_participant_assignments',
          `group-match-${code}-assignment-${side}`,
          {
            match_id: match,
            role: side === 0 ? 'home' : 'away',
            season_entry_id: core.entries[groupIndex * 2 + side],
            source_stage_participant_slot_id: participantSlots[side],
            reason: 'Вигадана групова гра',
            actor_id: actorId,
          },
        ),
      )
    }
    const score = await add(client, 'played_score_versions', `group-score-${code}`, {
      match_id: match,
      home_regulation_goals: groupIndex + 1,
      away_regulation_goals: 0,
      actor_id: actorId,
    })
    const result = await add(client, 'match_result_versions', `group-result-${code}`, {
      match_id: match,
      version_number: 1,
      played_score_version_id: score,
      home_assignment_id: assignments[0],
      away_assignment_id: assignments[1],
      confirmed_at: '2026-04-25T15:00:00Z',
      confirmed_by_actor_id: actorId,
    })
    await set(client, 'matches', `group-match-${code}`, {
      sporting_state: 'finished',
      current_result_version_id: result,
      current_home_assignment_id: assignments[0],
      current_away_assignment_id: assignments[1],
    })
    await add(client, 'final_standings_evidence', `group-evidence-${code}`, {
      snapshot_id: snapshot,
      match_result_version_id: result,
    })
  }
  await set(client, 'competition_stages', 'stage-groups', {
    sporting_state: 'finalized',
    current_final_standings_snapshot_id: snapshot,
  })
}

async function seedMatches(client: pg.PoolClient, core: Core): Promise<void> {
  const venue = await add(client, 'venues', 'alternate-venue', {
    name: 'Демо-арена (вигадана)',
    locality: 'Вигадане містечко',
    visibility: 'public',
  })
  const field = await add(client, 'playing_fields', 'alternate-field', {
    venue_id: venue,
    name: 'Основне поле',
    code: 'MAIN',
    is_default: true,
    default_duration_minutes: 120,
  })

  const round1 = await add(client, 'fixture_rounds', 'league-round-1', {
    stage_id: core.league.id,
    stage_version_id: core.league.version,
    code: 'L1',
    position: 1,
  })
  const round2 = await add(client, 'fixture_rounds', 'league-round-2', {
    stage_id: core.league.id,
    stage_version_id: core.league.version,
    code: 'L2',
    position: 2,
  })
  await add(client, 'rest_slots', 'league-round-1-rest', {
    fixture_round_id: round1,
    stage_participant_slot_id: core.leagueSlots[2],
    position: 2,
  })
  for (const [index, data] of [
    { round: round1, home: 0, away: 1 },
    { round: round2, home: 0, away: 2 },
  ].entries()) {
    const fixture = await add(client, 'fixture_slots', `league-fixture-${index}`, {
      stage_id: core.league.id,
      stage_version_id: core.league.version,
      slot_type: 'league',
      stable_code: `L${index + 1}-M1`,
    })
    await add(client, 'league_fixture_slots', `league-fixture-detail-${index}`, {
      fixture_slot_id: fixture,
      fixture_round_id: data.round,
      home_stage_participant_slot_id: core.leagueSlots[data.home],
      away_stage_participant_slot_id: core.leagueSlots[data.away],
      position: 1,
    })
    const match = await add(client, 'matches', `league-match-${index}`, {
      fixture_slot_id: fixture,
      stage_id: core.league.id,
      sporting_state: 'scheduled',
      visibility: 'public',
      calendar_uid: `golden-league-${index}@example.invalid`,
    })
    const home = await add(client, 'match_participant_assignments', `league-home-${index}`, {
      match_id: match,
      role: 'home',
      season_entry_id: core.entries[data.home],
      source_stage_participant_slot_id: core.leagueSlots[data.home],
      reason: 'Вигаданий календар',
      actor_id: actorId,
    })
    const away = await add(client, 'match_participant_assignments', `league-away-${index}`, {
      match_id: match,
      role: 'away',
      season_entry_id: core.entries[data.away],
      source_stage_participant_slot_id: core.leagueSlots[data.away],
      reason: 'Вигаданий календар',
      actor_id: actorId,
    })
    const firstSchedule = await add(
      client,
      'match_schedule_revisions',
      `league-schedule-${index}-1`,
      {
        match_id: match,
        kickoff_on: index === 0 ? '2026-04-04' : '2026-04-11',
        kickoff_at_local: index === 0 ? '14:00:00' : '16:30:00',
        timezone: 'Europe/Kyiv',
        kickoff_at_utc: index === 0 ? '2026-04-04T11:00:00Z' : '2026-04-11T13:30:00Z',
        venue_id: venue,
        playing_field_id: field,
        venue_name_snapshot: 'Демо-арена (вигадана)',
        playing_field_name_snapshot: 'Основне поле',
        venue_designation: 'home',
        home_assignment_id: home,
        away_assignment_id: away,
        internal_reason: 'Початкове демонстраційне призначення',
        actor_id: actorId,
        published_at: fixedTime,
      },
    )
    await set(client, 'matches', `league-match-${index}`, {
      current_home_assignment_id: home,
      current_away_assignment_id: away,
      current_schedule_revision_id: firstSchedule,
    })
    if (index === 0) {
      const played = await add(client, 'played_score_versions', 'league-played', {
        match_id: match,
        home_regulation_goals: 2,
        away_regulation_goals: 1,
        actor_id: actorId,
      })
      const firstResult = await add(client, 'match_result_versions', 'league-result-played', {
        match_id: match,
        version_number: 1,
        played_score_version_id: played,
        home_assignment_id: home,
        away_assignment_id: away,
        confirmed_at: '2026-04-04T14:00:00Z',
        confirmed_by_actor_id: actorId,
      })
      const ruling = await add(client, 'result_rulings', 'league-protest-ruling', {
        match_id: match,
        action: 'assign',
        reason: 'Вигаданий протест: технічна поразка господарів',
        decided_on: '2026-04-06',
        actor_id: actorId,
      })
      const technical = await add(client, 'technical_results', 'league-technical-score', {
        match_id: match,
        ruling_id: ruling,
        home_goals: 0,
        away_goals: 3,
      })
      const corrected = await add(client, 'match_result_versions', 'league-result-technical', {
        match_id: match,
        version_number: 2,
        technical_result_id: technical,
        home_assignment_id: home,
        away_assignment_id: away,
        confirmed_at: '2026-04-06T12:00:00Z',
        confirmed_by_actor_id: actorId,
        supersedes_result_id: firstResult,
      })
      await set(client, 'matches', `league-match-${index}`, {
        sporting_state: 'finished',
        current_result_version_id: corrected,
      })
      await add(client, 'standing_adjustment_decisions', 'league-adjustment', {
        stage_id: core.league.id,
        season_entry_id: core.entries[0],
        action: 'apply',
        points_delta: -1,
        effective_on: '2026-04-06',
        reason: 'Вигадане дисциплінарне рішення для перевірки таблиці',
        actor_id: actorId,
      })
    } else {
      const revision = await add(client, 'match_schedule_revisions', 'league-schedule-1-2', {
        match_id: match,
        previous_revision_id: firstSchedule,
        timezone: 'Europe/Kyiv',
        venue_id: venue,
        playing_field_id: field,
        venue_name_snapshot: 'Демо-арена (вигадана)',
        playing_field_name_snapshot: 'Основне поле',
        venue_designation: 'home',
        home_assignment_id: home,
        away_assignment_id: away,
        internal_reason: 'Вигадане перенесення через стан поля',
        public_explanation: 'Матч перенесено; нову дату оголосять пізніше.',
        actor_id: actorId,
        published_at: '2026-04-10T09:00:00Z',
      })
      await set(client, 'matches', `league-match-${index}`, {
        sporting_state: 'postponed',
        current_schedule_revision_id: revision,
      })
    }
  }

  await seedKnockout(client, core)
}

async function seedKnockout(client: pg.PoolClient, core: Core): Promise<void> {
  async function round(
    stage: Core['fixed'],
    key: string,
    position: number,
    bracketMode: 'fixed_bracket' | 'redraw_each_round',
    legCount: 1 | 2,
  ) {
    const id = await add(client, 'knockout_rounds', `round-${key}`, {
      stage_id: stage.id,
      stable_code: key.toUpperCase(),
    })
    const rules = await add(client, 'tie_resolution_rule_sets', `rules-${key}`, {
      round_id: id,
      version_number: 1,
      leg_count: legCount,
      validation_hash: `golden-${key}-penalties`,
    })
    for (const [index, step] of (legCount === 1
      ? ['regulation', 'penalties']
      : ['aggregate', 'penalties']
    ).entries()) {
      await add(client, 'tie_resolution_steps', `resolution-${key}-${index}`, {
        rule_set_id: rules,
        position: index + 1,
        step_type: step,
      })
    }
    const version = await add(client, 'knockout_round_versions', `round-version-${key}`, {
      round_id: id,
      stage_version_id: stage.version,
      version_number: 1,
      position,
      bracket_mode: bracketMode,
      tie_resolution_rule_set_id: rules,
    })
    await set(client, 'knockout_rounds', `round-${key}`, { current_version_id: version })
    return { id, version, rules, stage }
  }

  type Round = Awaited<ReturnType<typeof round>>
  async function tie(
    roundData: Round,
    key: string,
    position: number,
    homeEntry: string | null,
    awayEntry: string | null,
    placementKind: string | null = null,
  ) {
    const tieId = await add(client, 'knockout_ties', `tie-${key}`, {
      round_id: roundData.id,
      stable_code: key.toUpperCase(),
      sporting_state: homeEntry && awayEntry ? 'ready' : 'configured',
    })
    const slots: string[] = []
    for (const [index, entry] of [homeEntry, awayEntry].entries()) {
      const qualificationIndex =
        key === 'semi-a' ? [0, 3][index] : key === 'semi-b' ? [1, 2][index] : null
      slots.push(
        await add(client, 'knockout_tie_participant_slots', `tie-${key}-slot-${index}`, {
          tie_id: tieId,
          side: index === 0 ? 'home' : 'away',
          expected_source_kind:
            qualificationIndex !== null ? 'qualification' : entry ? 'direct_entry' : 'stage_output',
          source_qualification_slot_id:
            qualificationIndex !== null
              ? goldenId(`fixed-qualification-${qualificationIndex}`)
              : null,
          current_season_entry_id: entry,
        }),
      )
    }
    const version = await add(client, 'knockout_tie_versions', `tie-${key}-version`, {
      tie_id: tieId,
      round_version_id: roundData.version,
      version_number: 1,
      bracket_position: position,
      placement_kind: placementKind,
      home_slot_id: slots[0],
      away_slot_id: slots[1],
    })
    await set(client, 'knockout_ties', `tie-${key}`, { current_version_id: version })
    return { id: tieId, version, key, roundData, slots }
  }

  type Tie = Awaited<ReturnType<typeof tie>>
  async function knockoutMatch(
    tieData: Tie,
    role: 'single' | 'first_leg' | 'second_leg',
    homeEntry: string,
    awayEntry: string,
    score?: [number, number],
    penalties?: [number, number, string],
  ) {
    const key = `${tieData.key}-${role}`
    const fixture = await add(client, 'fixture_slots', `knockout-fixture-${key}`, {
      stage_id: tieData.roundData.stage.id,
      stage_version_id: tieData.roundData.stage.version,
      slot_type: 'knockout',
      stable_code: key.toUpperCase(),
    })
    await add(client, 'knockout_fixture_slots', `knockout-fixture-detail-${key}`, {
      fixture_slot_id: fixture,
      tie_id: tieData.id,
      match_role: role,
    })
    const match = await add(client, 'matches', `knockout-match-${key}`, {
      fixture_slot_id: fixture,
      stage_id: tieData.roundData.stage.id,
      sporting_state: 'scheduled',
      visibility: 'public',
      calendar_uid: `golden-${key}@example.invalid`,
    })
    const assignments: string[] = []
    for (const [index, entry] of [homeEntry, awayEntry].entries()) {
      assignments.push(
        await add(client, 'match_participant_assignments', `knockout-${key}-assignment-${index}`, {
          match_id: match,
          role: index === 0 ? 'home' : 'away',
          season_entry_id: entry,
          reason: 'Вигадана пара Golden Season',
          actor_id: actorId,
        }),
      )
    }
    await set(client, 'matches', `knockout-match-${key}`, {
      current_home_assignment_id: assignments[0],
      current_away_assignment_id: assignments[1],
    })
    if (!score) return { match, result: null as string | null, shootout: null as string | null }
    const played = await add(client, 'played_score_versions', `knockout-${key}-score`, {
      match_id: match,
      home_regulation_goals: score[0],
      away_regulation_goals: score[1],
      actor_id: actorId,
    })
    const shootout = penalties
      ? await add(client, 'penalty_shootout_versions', `knockout-${key}-penalties`, {
          match_id: match,
          home_successful_kicks: penalties[0],
          away_successful_kicks: penalties[1],
          winner_season_entry_id: penalties[2],
          actor_id: actorId,
        })
      : null
    const result = await add(client, 'match_result_versions', `knockout-${key}-result`, {
      match_id: match,
      version_number: 1,
      played_score_version_id: played,
      penalty_shootout_version_id: shootout,
      home_assignment_id: assignments[0],
      away_assignment_id: assignments[1],
      confirmed_at: '2026-06-01T17:00:00Z',
      confirmed_by_actor_id: actorId,
    })
    await set(client, 'matches', `knockout-match-${key}`, {
      sporting_state: 'finished',
      current_result_version_id: result,
    })
    return { match, result, shootout }
  }

  async function outcome(
    tieData: Tie,
    winner: string,
    first: string,
    second?: string,
    shootout?: string,
    aggregate?: [number, number],
  ) {
    const id = await add(client, 'tie_outcomes', `outcome-${tieData.key}`, {
      tie_id: tieData.id,
      tie_version_id: tieData.version,
      rule_set_id: tieData.roundData.rules,
      first_match_result_version_id: first,
      second_leg_result_version_id: second ?? null,
      decisive_shootout_version_id: shootout ?? null,
      aggregate_home_goals: aggregate?.[0] ?? null,
      aggregate_away_goals: aggregate?.[1] ?? null,
      winner_season_entry_id: winner,
      confirmed_at: '2026-06-02T12:00:00Z',
      actor_id: actorId,
    })
    await set(client, 'knockout_ties', `tie-${tieData.key}`, {
      sporting_state: 'finalized',
      current_outcome_id: id,
    })
    return id
  }

  const semifinal = await round(core.fixed, 'semi', 1, 'fixed_bracket', 1)
  const placement = await round(core.fixed, 'placement', 2, 'fixed_bracket', 1)
  const semiA = await tie(semifinal, 'semi-a', 1, core.entries[0], core.entries[3])
  const semiB = await tie(semifinal, 'semi-b', 2, core.entries[1], core.entries[2])
  const resultA = await knockoutMatch(
    semiA,
    'single',
    core.entries[0],
    core.entries[3],
    [1, 1],
    [5, 4, core.entries[0]],
  )
  const resultB = await knockoutMatch(semiB, 'single', core.entries[1], core.entries[2], [2, 0])
  await outcome(semiA, core.entries[0], resultA.result!, undefined, resultA.shootout!)
  await outcome(semiB, core.entries[1], resultB.result!)
  const final = await tie(placement, 'final', 1, core.entries[0], core.entries[1], 'final')
  const third = await tie(placement, 'third', 2, core.entries[3], core.entries[2], 'third_place')
  const finalMatch = await knockoutMatch(final, 'single', core.entries[0], core.entries[1], [2, 1])
  const thirdMatch = await knockoutMatch(third, 'single', core.entries[3], core.entries[2], [1, 0])
  const finalOutcome = await outcome(final, core.entries[0], finalMatch.result!)
  const thirdOutcome = await outcome(third, core.entries[3], thirdMatch.result!)
  const placements = [
    ['champion', core.entries[0], finalOutcome],
    ['runner_up', core.entries[1], finalOutcome],
    ['third', core.entries[3], thirdOutcome],
    ['fourth', core.entries[2], thirdOutcome],
  ] as const
  const snapshot = await add(client, 'final_knockout_snapshots', 'fixed-snapshot', {
    stage_id: core.fixed.id,
    stage_version_id: core.fixed.version,
    finalization_number: 1,
    input_hash: 'golden-fixed-results-v1',
    actor_id: actorId,
    finalized_at: '2026-06-10T12:00:00Z',
  })
  for (const [index, [placementKind, entry, tieOutcomeId]] of placements.entries()) {
    const placementOutput = await add(client, 'placement_outputs', `fixed-placement-${index}`, {
      stage_id: core.fixed.id,
      tie_outcome_id: tieOutcomeId,
      placement_kind: placementKind,
      season_entry_id: entry,
    })
    await add(client, 'final_knockout_evidence', `fixed-snapshot-evidence-${index}`, {
      snapshot_id: snapshot,
      placement_output_id: placementOutput,
    })
  }
  await set(client, 'competition_stages', 'stage-fixed', {
    sporting_state: 'finalized',
    current_final_knockout_snapshot_id: snapshot,
  })

  const redrawn = await round(core.redraw, 'redraw-one', 1, 'redraw_each_round', 2)
  const redrawTie = await tie(redrawn, 'redraw-a', 1, core.entries[0], core.entries[1])
  const pendingTie = await tie(redrawn, 'redraw-pending', 2, null, null)
  const drawPool = await add(client, 'draw_pools', 'redraw-pool', {
    round_version_id: redrawn.version,
    code: 'OPEN',
    mode: 'open',
    position: 1,
  })
  const poolEntries: string[] = []
  for (let index = 0; index < 2; index++) {
    poolEntries.push(
      await add(client, 'draw_pool_entries', `draw-pool-entry-${index}`, {
        draw_pool_id: drawPool,
        season_entry_id: core.entries[index],
        position: index + 1,
      }),
    )
  }
  const draw = await add(client, 'draw_outcomes', 'redraw-outcome', {
    round_id: redrawn.id,
    round_version_id: redrawn.version,
    external_draw_on: '2026-05-01',
    actor_id: actorId,
    content_hash: 'golden-redraw-outcome-v1',
  })
  for (let index = 0; index < 2; index++) {
    const assignment = await add(client, 'draw_outcome_assignments', `redraw-assignment-${index}`, {
      draw_outcome_id: draw,
      draw_pool_entry_id: poolEntries[index],
      tie_participant_slot_id: redrawTie.slots[index],
    })
    await set(client, 'knockout_tie_participant_slots', `tie-redraw-a-slot-${index}`, {
      current_draw_assignment_id: assignment,
    })
  }
  const firstLeg = await knockoutMatch(
    redrawTie,
    'first_leg',
    core.entries[0],
    core.entries[1],
    [1, 0],
  )
  const secondLeg = await knockoutMatch(
    redrawTie,
    'second_leg',
    core.entries[1],
    core.entries[0],
    [1, 0],
    [3, 4, core.entries[0]],
  )
  await outcome(
    redrawTie,
    core.entries[0],
    firstLeg.result!,
    secondLeg.result!,
    secondLeg.shootout!,
    [1, 1],
  )

  // The second redrawn pairing cannot progress until its participants and result are final.
  const blockedSlot = await add(client, 'fixture_slots', 'redraw-blocked-fixture', {
    stage_id: core.redraw.id,
    stage_version_id: core.redraw.version,
    slot_type: 'knockout',
    stable_code: 'REDRAW-PENDING-SINGLE',
  })
  await add(client, 'knockout_fixture_slots', 'redraw-blocked-fixture-detail', {
    fixture_slot_id: blockedSlot,
    tie_id: pendingTie.id,
    match_role: 'single',
  })
  await add(client, 'matches', 'redraw-blocked-match', {
    fixture_slot_id: blockedSlot,
    stage_id: core.redraw.id,
    sporting_state: 'unscheduled',
    visibility: 'private',
    calendar_uid: 'golden-redraw-blocked@example.invalid',
  })
  const byeSource = await add(client, 'qualification_slots', 'bye-source', {
    stage_id: core.redraw.id,
    knockout_round_id: redrawn.id,
    stable_code: 'BYE-SOURCE',
    position: 1,
  })
  const byeDestination = await add(client, 'qualification_slots', 'bye-destination', {
    stage_id: core.redraw.id,
    knockout_round_id: redrawn.id,
    stable_code: 'BYE-DESTINATION',
    position: 2,
  })
  await add(client, 'confirmed_byes', 'redraw-bye', {
    source_slot_id: byeSource,
    destination_slot_id: byeDestination,
    season_entry_id: core.entries[2],
    draw_outcome_id: draw,
    reason: 'Вигадана непарна кількість учасників етапу',
    actor_id: actorId,
  })
}

async function seedRosters(
  client: pg.PoolClient,
  core: Pick<Core, 'season' | 'entries'>,
): Promise<void> {
  const registration = await add(client, 'registration_windows', 'roster-window', {
    season_id: core.season,
    window_type: 'roster_registration',
    starts_on: '2026-02-01',
    ends_on: '2026-03-31',
    timezone: 'Europe/Kyiv',
    state: 'closed',
  })
  const transferWindow = await add(client, 'registration_windows', 'transfer-window', {
    season_id: core.season,
    window_type: 'roster_transfer',
    starts_on: '2026-07-01',
    ends_on: '2026-07-31',
    timezone: 'Europe/Kyiv',
    state: 'closed',
  })
  const rules = await add(client, 'roster_rule_sets', 'roster-rules', {
    season_id: core.season,
    version_number: 1,
    minimum_size: 0,
    maximum_size: 30,
    readiness_required: false,
    effective_from_at: fixedTime,
    author_id: actorId,
  })
  await add(client, 'legionnaire_quota_versions', 'legionnaire-quota', {
    roster_rule_set_id: rules,
    base_limit: 3,
    additional_limit: 2,
    additional_birth_date_cutoff: '1991-12-31',
  })
  const rosters = []
  for (let index = 0; index < 2; index++) {
    rosters.push(
      await add(client, 'season_rosters', `roster-${index}`, {
        season_entry_id: core.entries[index],
        current_rule_set_id: rules,
      }),
    )
  }

  const people = [
    {
      name: 'Демо Місцевий',
      given: 'Демо',
      family: 'Місцевий',
      birth: '1995-05-15',
      state: 'minimal',
    },
    {
      name: 'Демо Легіонер-Старший',
      given: 'Демо',
      family: 'Легіонер-Старший',
      birth: '1991-12-31',
      state: 'minimal',
    },
    {
      name: 'Демо Легіонер-Молодший',
      given: 'Демо',
      family: 'Легіонер-Молодший',
      birth: '2001-06-01',
      state: 'minimal',
    },
    {
      name: 'Демо Неповнолітній',
      given: 'Демо',
      family: 'Неповнолітній',
      birth: '2011-09-01',
      state: 'restricted',
    },
  ] as const
  const players: string[] = []
  for (const [index, person] of people.entries()) {
    const player = await add(client, 'players', `player-${index}`, {
      public_profile_state: person.state,
    })
    const identity = await add(client, 'player_identity_versions', `player-identity-${index}`, {
      player_id: player,
      given_name: person.given,
      family_name: person.family,
      display_name: person.name,
      normalized_search_name: person.name.toLowerCase(),
      author_id: actorId,
    })
    const privateDetails = await add(client, 'player_private_details', `player-private-${index}`, {
      player_id: player,
    })
    const privateVersion = await add(
      client,
      'player_private_detail_versions',
      `player-birth-${index}`,
      {
        private_details_id: privateDetails,
        date_of_birth: person.birth,
        author_id: actorId,
      },
    )
    await set(client, 'players', `player-${index}`, { current_identity_version_id: identity })
    await set(client, 'player_private_details', `player-private-${index}`, {
      current_version_id: privateVersion,
    })
    players.push(player)
  }

  const entryKeys = ['local', 'senior-legionnaire', 'young-legionnaire', 'minor']
  for (const [index, key] of entryKeys.entries()) {
    const entry = await add(client, 'roster_entries', `roster-entry-${key}`, {
      roster_id: rosters[0],
      player_id: players[index],
      state: 'active',
    })
    const classification = await add(
      client,
      'legionnaire_classification_decisions',
      `classification-${key}`,
      {
        roster_entry_id: entry,
        classification: index === 0 || index === 3 ? 'local' : 'legionnaire',
        basis:
          index === 1
            ? 'Вигаданий гравець 1991 року народження: додаткова квота 35+'
            : 'Вигадана територіальна класифікація',
        actor_id: actorId,
      },
    )
    await set(client, 'roster_entries', `roster-entry-${key}`, {
      current_classification_decision_id: classification,
    })
    await add(client, 'roster_registration_periods', `registration-period-${key}`, {
      player_id: players[index],
      season_id: core.season,
      roster_entry_id: entry,
      effective_period: index === 0 ? '[2026-03-01,2026-07-01)' : '[2026-03-01,2026-12-01)',
    })
  }
  const destination = await add(client, 'roster_entries', 'roster-entry-local-destination', {
    roster_id: rosters[1],
    player_id: players[0],
    state: 'active',
  })
  await add(client, 'roster_registration_periods', 'registration-period-local-destination', {
    player_id: players[0],
    season_id: core.season,
    roster_entry_id: destination,
    effective_period: '[2026-07-01,2026-12-01)',
  })
  await add(client, 'roster_transfers', 'midseason-transfer', {
    source_roster_entry_id: goldenId('roster-entry-local'),
    destination_roster_entry_id: destination,
    player_id: players[0],
    season_id: core.season,
    transfer_window_id: transferWindow,
    effective_on: '2026-07-01',
    state: 'completed',
    reason: 'Вигаданий перехід у трансферне вікно',
  })
  await add(client, 'roster_eligibility_rulings', 'minor-eligibility-exception', {
    roster_entry_id: goldenId('roster-entry-minor'),
    waived_rule_code: 'DEMO_MINOR_CASE',
    effective_period: '[2026-03-01,2026-12-01)',
    reason: 'Синтетичний виняток для перевірки доступу; не є реальним дозволом',
    actor_id: actorId,
  })
  void registration
}

async function seedEditorial(
  client: pg.PoolClient,
  core: { competition: string; season: string },
): Promise<void> {
  const upload = await add(client, 'media_upload_intents', 'media-upload', {
    uploader_id: actorId,
    idempotency_key: 'golden-season-cover-v1',
    temporary_object_key: 'golden-season/fictional-cover-upload.webp',
    expected_mime_type: 'image/webp',
    expected_size_bytes: 1024,
    expires_at: '2026-12-31T23:59:59Z',
    state: 'verified',
  })
  const media = await add(client, 'media_assets', 'media-cover', {
    upload_intent_id: upload,
    original_filename: 'fictional-cover.webp',
    original_object_key: 'golden-season/fictional-cover.webp',
    original_checksum: 'synthetic-fixture-only-not-a-real-upload',
    mime_type: 'image/webp',
    size_bytes: 1024,
    width: 1200,
    height: 675,
    state: 'active',
    uploaded_by_id: actorId,
  })
  const metadata = await add(client, 'media_asset_metadata_versions', 'media-cover-metadata', {
    media_asset_id: media,
    source: 'Golden Season synthetic fixture',
    rights_statement: 'Fictional placeholder; no binary is uploaded by the seed',
    default_alt_text: 'Умовна обкладинка демонстраційної новини',
    author_id: actorId,
  })
  const presentation = await add(client, 'media_presentations', 'media-cover-presentation', {
    media_asset_id: media,
    transformation_version: 'golden-fixture-v1',
    readiness: 'ready',
  })
  await set(client, 'media_assets', 'media-cover', {
    current_metadata_version_id: metadata,
    current_presentation_id: presentation,
  })
  const category = await add(client, 'article_categories', 'article-category', {
    name: 'Демо-новини',
    slug: 'demo-news',
    normalized_slug: 'demo-news',
  })
  const categoryVersion = await add(
    client,
    'article_category_versions',
    'article-category-version',
    {
      category_id: category,
      name: 'Демо-новини',
      slug: 'demo-news',
      actor_id: actorId,
    },
  )
  await set(client, 'article_categories', 'article-category', {
    current_version_id: categoryVersion,
  })

  const definitions = [
    { key: 'draft', state: 'draft', title: 'Чернетка: вигаданий календар' },
    { key: 'scheduled', state: 'scheduled', title: 'Запланована демо-публікація' },
    { key: 'published', state: 'published', title: 'Демо-новина Golden Season' },
    { key: 'archived', state: 'archived', title: 'Архівна демо-новина' },
  ] as const
  for (const definition of definitions) {
    const key = definition.key
    const article = await add(client, 'news_articles', `article-${key}`, {
      lifecycle_state: definition.state,
      author_id: actorId,
    })
    const slug = await add(client, 'article_slugs', `article-slug-${key}`, {
      article_id: article,
      display_slug: `golden-${key}`,
      normalized_slug: `golden-${key}`,
      valid_from_at: fixedTime,
    })
    const body = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Синтетичні дані для перевірки порталу.' }],
        },
      ],
    }
    const working = await add(client, 'article_working_copies', `article-working-${key}`, {
      article_id: article,
      title: definition.title,
      summary: 'Демонстраційний матеріал, не офіційна новина федерації.',
      body,
      content_schema_version: 1,
      category_id: category,
      proposed_slug: `golden-${key}`,
      validation_state: 'valid',
    })
    await set(client, 'news_articles', `article-${key}`, {
      current_working_copy_id: working,
      current_slug_id: slug,
    })
    if (key === 'scheduled') {
      await add(client, 'article_publication_schedules', 'article-schedule', {
        article_id: article,
        due_at: '2026-11-10T09:00:00Z',
        working_copy_id: working,
        expected_working_version: 1,
      })
    }
    if (key === 'published' || key === 'archived') {
      const firstRevision = await add(client, 'article_revisions', `article-revision-${key}-1`, {
        article_id: article,
        slug_id: slug,
        category_id: category,
        category_name_snapshot: 'Демо-новини',
        title: definition.title,
        summary: 'Демонстраційний матеріал, не офіційна новина федерації.',
        body,
        content_schema_version: 1,
        content_hash: `golden-article-${key}-v1`,
        published_at: '2026-04-01T09:00:00Z',
        author_id: actorId,
      })
      let currentRevision = firstRevision
      if (key === 'published') {
        currentRevision = await add(client, 'article_revisions', 'article-revision-published-2', {
          article_id: article,
          slug_id: slug,
          category_id: category,
          category_name_snapshot: 'Демо-новини',
          title: 'Демо-новина Golden Season — уточнено',
          summary: 'Уточнена синтетична новина; не офіційне повідомлення.',
          body,
          content_schema_version: 1,
          content_hash: 'golden-article-published-v2',
          published_at: '2026-04-02T09:00:00Z',
          author_id: actorId,
          internal_reason: 'Вигадане виправлення редакції',
          public_correction_explanation: 'Уточнено демонстраційний заголовок.',
          supersedes_revision_id: firstRevision,
        })
        await add(client, 'article_media_placements_revision', 'article-cover', {
          revision_id: currentRevision,
          media_asset_id: media,
          presentation_id: presentation,
          role: 'cover',
          position: 1,
          alt_text: 'Умовна обкладинка демонстраційної новини',
          decorative: false,
          attribution_snapshot: 'Golden Season synthetic fixture',
        })
      }
      await set(client, 'news_articles', `article-${key}`, {
        first_published_at: '2026-04-01T09:00:00Z',
        original_published_at: '2026-04-01T09:00:00Z',
        current_published_revision_id: currentRevision,
      })
      await add(client, 'article_competition_associations_revision', `article-competition-${key}`, {
        revision_id: currentRevision,
        competition_id: core.competition,
      })
      await add(client, 'article_season_associations_revision', `article-season-${key}`, {
        revision_id: currentRevision,
        season_id: core.season,
      })
    }
  }
}

async function seedOperations(
  client: pg.PoolClient,
  core: { competition: string; season: string },
): Promise<void> {
  const audit = await add(client, 'audit_events', 'seed-audit', {
    actor_kind: 'system',
    actor_display_snapshot: 'Golden Season fixture',
    action: 'golden_season.seed',
    outcome: 'succeeded',
    reason: 'Synthetic non-production fixture only',
    source: 'seed-command',
    correlation_key: 'golden-season-v1',
  })
  await add(client, 'audit_event_targets', 'seed-audit-target', {
    audit_event_id: audit,
    role: 'primary',
    target_type: 'season',
    target_id: core.season,
    display_snapshot: 'Golden Season 2026',
  })
  await add(client, 'outbox_messages', 'seed-outbox', {
    message_type: 'fixture.synthetic_seed_ready',
    schema_version: 1,
    payload: { seasonId: core.season, competitionId: core.competition },
    aggregate_type: 'season',
    aggregate_id: core.season,
    aggregate_version: 1,
    correlation_key: 'golden-season-v1',
    available_at: fixedTime,
    state: 'succeeded',
    sanitized_outcome: 'Synthetic fixture installed',
  })
}
