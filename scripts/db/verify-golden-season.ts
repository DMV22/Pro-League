import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import { createPublicSeasonPathQueries } from '../../src/server/queries/public-season-path'
import { goldenId } from './golden-season-fixture'
import { assertGoldenSeasonTarget, type GoldenSeasonTarget } from './golden-season-target'
import { loadProjectEnv } from './load-env'
import { readMigrationManifest } from './migration-ledger'

loadProjectEnv()
const option = (name: string) =>
  process.argv
    .slice(2)
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3)
const target = option('target')
if (target !== 'local' && target !== 'ci' && target !== 'preview') {
  throw new Error('Specify --target=local|ci|preview')
}
const database = assertGoldenSeasonTarget(
  process.env.SEED_DATABASE_URL,
  target as GoldenSeasonTarget,
  option('confirm-db'),
  option('preview-pr') ? Number(option('preview-pr')) : undefined,
)
const client = new pg.Client({
  connectionString: process.env.SEED_DATABASE_URL,
  connectionTimeoutMillis: 5_000,
})
await client.connect()
const expectedRelationshipDigest =
  '356709a5a2fd1b8d430751f3d00a1e071d85f742d05f730cc0caec9cadc9c961'

async function count(sql: string, parameters: string[], expected: number): Promise<void> {
  const result = await client.query<{ total: string }>(
    `select count(*)::text as total ${sql}`,
    parameters,
  )
  assert.equal(Number(result.rows[0]?.total), expected, sql)
}

try {
  const identity = await client.query<{ database: string }>('select current_database() as database')
  assert.equal(identity.rows[0]?.database, database)
  await count('from app.__drizzle_migrations', [], readMigrationManifest().length)
  await count('from app.competitions', [], 1)
  await count('from app.seasons', [], 1)
  await count('from app.season_entries', [], 4)
  await count('from app.competition_stages', [], 4)
  await count("from app.competition_stage_versions where format_type = 'league'", [], 2)
  await count("from app.competition_stage_versions where format_type = 'knockout'", [], 2)
  await count('from app.stage_groups', [], 2)
  await count('from app.final_standings_rows', [], 4)
  await count('from app.final_knockout_snapshots', [], 1)
  await count('from app.placement_outputs', [], 4)
  await count(
    `from app.final_standings_rows where snapshot_id = $1 and season_entry_id = $2
     and group_id = $3 and position = 1 and played = 1 and wins = 1
     and goals_for = 1 and goals_against = 0 and points = 3`,
    [goldenId('groups-snapshot'), goldenId('entry-0'), goldenId('group-A')],
    1,
  )
  await count(
    `from app.final_standings_rows where snapshot_id = $1 and season_entry_id = $2
     and group_id = $3 and position = 1 and played = 1 and wins = 1
     and goals_for = 2 and goals_against = 0 and points = 3`,
    [goldenId('groups-snapshot'), goldenId('entry-2'), goldenId('group-B')],
    1,
  )
  await count(
    `from app.placement_outputs where stage_id = $1 and placement_kind = 'champion'
     and season_entry_id = $2`,
    [goldenId('stage-fixed'), goldenId('entry-0')],
    1,
  )
  await count('from app.qualification_outputs', [], 4)
  await count('from app.rest_slots', [], 1)
  await count("from app.knockout_round_versions where bracket_mode = 'fixed_bracket'", [], 2)
  await count("from app.knockout_round_versions where bracket_mode = 'redraw_each_round'", [], 1)
  await count('from app.draw_outcomes', [], 1)
  await count('from app.confirmed_byes', [], 1)
  await count('from app.penalty_shootout_versions', [], 2)
  await count("from app.knockout_tie_versions where placement_kind = 'third_place'", [], 1)
  await count("from app.knockout_tie_versions where placement_kind = 'final'", [], 1)
  await count("from app.knockout_fixture_slots where match_role = 'first_leg'", [], 1)
  await count("from app.knockout_fixture_slots where match_role = 'second_leg'", [], 1)
  await count('from app.roster_transfers', [], 1)
  await count('from app.legionnaire_quota_versions', [], 1)
  await count('from app.roster_eligibility_rulings', [], 1)
  await count('from app.news_articles', [], 4)
  await count('from app.media_assets', [], 1)
  await count('from app.audit_events', [], 1)
  await count('from app.outbox_messages', [], 1)

  const corrected = await client.query<{
    result_id: string
    home_goals: number
    away_goals: number
    supersedes_result_id: string
  }>(
    `select r.id as result_id, t.home_goals, t.away_goals, r.supersedes_result_id
     from app.matches m
     join app.match_result_versions r on r.id = m.current_result_version_id
     join app.technical_results t on t.id = r.technical_result_id
     where m.id = $1`,
    [goldenId('league-match-0')],
  )
  assert.deepEqual(corrected.rows[0], {
    result_id: goldenId('league-result-technical'),
    home_goals: 0,
    away_goals: 3,
    supersedes_result_id: goldenId('league-result-played'),
  })
  await count(
    `from app.matches m join app.match_schedule_revisions s on s.id = m.current_schedule_revision_id
     where m.id = $1 and m.sporting_state = 'postponed' and s.kickoff_at_utc is null`,
    [goldenId('league-match-1')],
    1,
  )
  await count(
    `from app.match_schedule_revisions s join app.matches m on m.id = s.match_id
     where m.id = $1 and s.venue_designation = 'home' and s.playing_field_id is not null`,
    [goldenId('league-match-0')],
    1,
  )
  await count(
    `from app.knockout_ties t join app.matches m on m.fixture_slot_id =
       (select fixture_slot_id from app.knockout_fixture_slots where tie_id = t.id)
     where t.id = $1 and t.current_outcome_id is null and m.sporting_state = 'unscheduled'`,
    [goldenId('tie-redraw-pending')],
    1,
  )
  await count(
    `from app.tie_outcomes where tie_id = $1 and aggregate_home_goals = 1
     and aggregate_away_goals = 1 and decisive_shootout_version_id is not null`,
    [goldenId('tie-redraw-a')],
    1,
  )
  await count(
    `from app.legionnaire_quota_versions where additional_birth_date_cutoff = '1991-12-31'
     and base_limit = 3 and additional_limit = 2`,
    [],
    1,
  )
  await count(
    `from app.roster_entries e
     join app.legionnaire_classification_decisions c on c.id = e.current_classification_decision_id
     join app.player_private_details d on d.player_id = e.player_id
     join app.player_private_detail_versions v on v.id = d.current_version_id
     where e.id = $1 and c.classification = 'legionnaire' and v.date_of_birth = '1991-12-31'`,
    [goldenId('roster-entry-senior-legionnaire')],
    1,
  )
  await count(
    `from app.players p join app.player_private_details d on d.player_id = p.id
     join app.player_private_detail_versions v on v.id = d.current_version_id
     where p.id = $1 and p.public_profile_state = 'restricted' and v.date_of_birth = '2011-09-01'`,
    [goldenId('player-3')],
    1,
  )
  await count(
    `from app.roster_registration_periods a join app.roster_registration_periods b
       on a.player_id = b.player_id and a.id <> b.id
     where a.player_id = $1 and upper(a.effective_period) = lower(b.effective_period)
       and not (a.effective_period && b.effective_period)`,
    [goldenId('player-0')],
    1,
  )
  await count(
    `from app.news_articles a join app.article_revisions r on r.id = a.current_published_revision_id
     join app.article_media_placements_revision p on p.revision_id = r.id
     where a.id = $1 and r.supersedes_revision_id is not null and p.role = 'cover'`,
    [goldenId('article-published')],
    1,
  )
  for (const state of ['draft', 'scheduled', 'published', 'archived']) {
    await count('from app.news_articles where lifecycle_state = $1', [state], 1)
  }

  const publicQueries = createPublicSeasonPathQueries(drizzle({ client }))
  const publicCompetitions = await publicQueries.listCompetitions()
  assert.deepEqual(publicCompetitions, [
    { id: goldenId('competition'), name: 'Вигаданий кубок громад' },
  ])
  const publicPath = await publicQueries.getSeasonPath(goldenId('competition'), goldenId('season'))
  assert.ok(publicPath)
  assert.equal(publicPath.entries.length, 4)
  assert.equal(publicPath.fixtureRounds.length, 4)
  const correctedPublicMatch = publicPath.fixtureRounds
    .flatMap((round) => round.matches)
    .find((match) => match.id === goldenId('league-match-0'))
  assert.equal(correctedPublicMatch?.result?.kind, 'technical')
  assert.equal(correctedPublicMatch?.result?.id, goldenId('league-result-technical'))
  if (correctedPublicMatch?.result?.kind === 'technical') {
    assert.equal(correctedPublicMatch.result.homeGoals, 0)
    assert.equal(correctedPublicMatch.result.awayGoals, 3)
  }
  const postponedPublicMatch = publicPath.fixtureRounds
    .flatMap((round) => round.matches)
    .find((match) => match.id === goldenId('league-match-1'))
  assert.equal(postponedPublicMatch?.sportingState, 'postponed')
  assert.equal(postponedPublicMatch?.kickoffOn, null)
  assert.equal(postponedPublicMatch?.result, null)
  assert.ok(publicPath.standingsInputs.some((input) => input.publishedResults.length > 0))

  const stable = await client.query<{ kind: string; id: string; relation: string }>(
    `select 'stage' as kind, id::text, code as relation from app.competition_stages
     union all select 'match', id::text, sporting_state from app.matches
     union all select 'entry', id::text, team_id::text from app.season_entries
     union all select 'article', id::text, lifecycle_state from app.news_articles
     order by kind, id`,
  )
  const digest = createHash('sha256').update(JSON.stringify(stable.rows)).digest('hex')
  assert.equal(
    digest,
    expectedRelationshipDigest,
    'Golden Season stable identifiers or relationships changed',
  )
  process.stdout.write(
    `Golden Season verified in ${database}; stable relationship digest: ${digest}\n`,
  )
} finally {
  await client.end()
}
