import assert from 'node:assert/strict'

import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import {
  competitionFormatDrafts,
  competitionFormats,
  competitionFormatVersions,
  competitions,
  competitionStages,
  competitionStageVersions,
  seasons,
} from '../../src/modules/competition/infrastructure/schema'
import {
  fixtureRounds,
  fixtureSlots,
  leagueFixtureSlots,
  matchParticipantAssignments,
  matches,
  matchResultVersions,
  matchScheduleRevisions,
  playedScoreVersions,
  resultRulings,
  technicalResults,
} from '../../src/modules/match/infrastructure/schema'
import {
  seasonApplications,
  seasonEntries,
  teams,
} from '../../src/modules/registration/infrastructure/schema'
import {
  pointsSchemes,
  rankingRuleSets,
  stageParticipantSlots,
  standingAdjustmentDecisions,
  tieBreakers,
} from '../../src/modules/standings-progression/infrastructure/schema'
import { assertLocalDatabaseUrl, readDatabaseUrl } from '../../src/server/db/config'
import {
  createPublicSeasonContentQueries,
  createPublicSeasonStandingsQueries,
} from '../../src/server/queries/public-season-path'
import { loadProjectEnv } from './load-env'

loadProjectEnv()
const url = readDatabaseUrl('DATABASE_URL')
assertLocalDatabaseUrl(url, 'DATABASE_URL')

const uid = (number: number) => `01990000-0000-7000-8000-${number.toString(16).padStart(12, '0')}`
const ids = {
  competition: uid(1),
  privateCompetition: uid(2),
  season: uid(3),
  emptySeason: uid(4),
  privateSeason: uid(5),
  seasonOfPrivateCompetition: uid(6),
  teamA: uid(7),
  teamB: uid(8),
  privateTeam: uid(9),
  applicationA: uid(10),
  applicationB: uid(11),
  applicationPrivate: uid(12),
  entryA: uid(13),
  entryB: uid(14),
  entryPrivate: uid(15),
  format: uid(16),
  draft: uid(17),
  formatVersion: uid(18),
  stage: uid(19),
  stageVersion: uid(20),
  participantA: uid(21),
  participantB: uid(22),
  roundA: uid(23),
  roundB: uid(24),
  slotA: uid(25),
  slotB: uid(26),
  slotPublicB: uid(41),
  matchA: uid(27),
  privateMatch: uid(28),
  publicMatchB: uid(42),
  leagueSlotA: uid(29),
  leagueSlotB: uid(30),
  leagueSlotPublicB: uid(43),
  assignmentHome: uid(31),
  assignmentAway: uid(32),
  privateAssignmentHome: uid(45),
  publicAssignmentAway: uid(46),
  schedule: uid(33),
  playedScore: uid(34),
  playedResult: uid(35),
  ruling: uid(36),
  technicalScore: uid(37),
  technicalResult: uid(38),
  rankingRules: uid(39),
  points: uid(40),
  tieBreaker: uid(44),
  publicAdjustment: uid(47),
  privateAdjustment: uid(48),
}
const actorId = uid(100)
const databasePool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5_000 })
const client = await databasePool.connect()

try {
  const schema = await client.query<{ table_name: string | null }>(
    "select to_regclass('app.competitions')::text as table_name",
  )
  if (!schema.rows[0]?.table_name) {
    throw new Error('Apply the initial migration to DATABASE_URL before public query verification')
  }
  await client.query('BEGIN')
  const database = drizzle({ client })
  const queries = createPublicSeasonContentQueries(database)

  await database.insert(competitions).values([
    { id: ids.competition, displayName: 'Public Cup', visibility: 'public' },
    { id: ids.privateCompetition, displayName: 'Hidden Cup', visibility: 'private' },
  ])
  await database.insert(seasons).values([
    {
      id: ids.season,
      competitionId: ids.competition,
      name: '2026',
      timezone: 'Europe/Kyiv',
      visibility: 'public',
    },
    {
      id: ids.emptySeason,
      competitionId: ids.competition,
      name: 'Empty season',
      timezone: 'Europe/Kyiv',
      visibility: 'public',
    },
    {
      id: ids.privateSeason,
      competitionId: ids.competition,
      name: 'Hidden season',
      timezone: 'Europe/Kyiv',
      visibility: 'private',
    },
    {
      id: ids.seasonOfPrivateCompetition,
      competitionId: ids.privateCompetition,
      name: '2026',
      timezone: 'Europe/Kyiv',
      visibility: 'public',
    },
  ])
  await database.insert(teams).values([
    { id: ids.teamA, displayName: 'Public A', visibility: 'public' },
    { id: ids.teamB, displayName: 'Public B', visibility: 'public' },
    { id: ids.privateTeam, displayName: 'Secret Team', visibility: 'private' },
  ])
  await database.insert(seasonApplications).values([
    { id: ids.applicationA, seasonId: ids.season, teamId: ids.teamA, state: 'approved' },
    { id: ids.applicationB, seasonId: ids.season, teamId: ids.teamB, state: 'approved' },
    {
      id: ids.applicationPrivate,
      seasonId: ids.season,
      teamId: ids.privateTeam,
      state: 'approved',
    },
  ])
  await database.insert(seasonEntries).values([
    {
      id: ids.entryA,
      seasonId: ids.season,
      teamId: ids.teamA,
      approvedApplicationId: ids.applicationA,
    },
    {
      id: ids.entryB,
      seasonId: ids.season,
      teamId: ids.teamB,
      approvedApplicationId: ids.applicationB,
    },
    {
      id: ids.entryPrivate,
      seasonId: ids.season,
      teamId: ids.privateTeam,
      approvedApplicationId: ids.applicationPrivate,
    },
  ])
  await database.insert(competitionFormats).values({ id: ids.format, seasonId: ids.season })
  await database
    .insert(competitionFormatDrafts)
    .values({ id: ids.draft, formatId: ids.format, editingContext: 'test' })
  await database.insert(competitionFormatVersions).values({
    id: ids.formatVersion,
    formatId: ids.format,
    seasonId: ids.season,
    versionNumber: 1,
    contentHash: 'synthetic-format',
    sourceDraftId: ids.draft,
    authorId: actorId,
  })
  await database
    .update(seasons)
    .set({ currentFormatVersionId: ids.formatVersion })
    .where(eq(seasons.id, ids.season))
  await database
    .insert(competitionStages)
    .values({ id: ids.stage, seasonId: ids.season, code: 'league' })
  await database.insert(competitionStageVersions).values({
    id: ids.stageVersion,
    stageId: ids.stage,
    formatVersionId: ids.formatVersion,
    name: 'League stage',
    position: 1,
    formatType: 'league',
    configurationHash: 'synthetic-stage',
  })
  await database
    .update(competitionStages)
    .set({ currentVersionId: ids.stageVersion })
    .where(eq(competitionStages.id, ids.stage))
  await database.insert(stageParticipantSlots).values([
    {
      id: ids.participantA,
      stageId: ids.stage,
      stageVersionId: ids.stageVersion,
      stableCode: 'A',
      position: 1,
      expectedSourceKind: 'direct_entry',
    },
    {
      id: ids.participantB,
      stageId: ids.stage,
      stageVersionId: ids.stageVersion,
      stableCode: 'B',
      position: 2,
      expectedSourceKind: 'direct_entry',
    },
  ])
  await database.insert(fixtureRounds).values([
    {
      id: ids.roundA,
      stageId: ids.stage,
      stageVersionId: ids.stageVersion,
      code: 'round-1',
      position: 1,
    },
    {
      id: ids.roundB,
      stageId: ids.stage,
      stageVersionId: ids.stageVersion,
      code: 'round-2',
      position: 2,
    },
  ])
  await database.insert(fixtureSlots).values([
    {
      id: ids.slotA,
      stageId: ids.stage,
      stageVersionId: ids.stageVersion,
      slotType: 'league',
      stableCode: 'match-1',
    },
    {
      id: ids.slotB,
      stageId: ids.stage,
      stageVersionId: ids.stageVersion,
      slotType: 'league',
      stableCode: 'match-2',
    },
    {
      id: ids.slotPublicB,
      stageId: ids.stage,
      stageVersionId: ids.stageVersion,
      slotType: 'league',
      stableCode: 'match-3',
    },
  ])
  await database.insert(leagueFixtureSlots).values([
    {
      id: ids.leagueSlotA,
      fixtureSlotId: ids.slotA,
      fixtureRoundId: ids.roundA,
      homeStageParticipantSlotId: ids.participantA,
      awayStageParticipantSlotId: ids.participantB,
      position: 1,
    },
    {
      id: ids.leagueSlotB,
      fixtureSlotId: ids.slotB,
      fixtureRoundId: ids.roundB,
      homeStageParticipantSlotId: ids.participantA,
      awayStageParticipantSlotId: ids.participantB,
      position: 1,
    },
    {
      id: ids.leagueSlotPublicB,
      fixtureSlotId: ids.slotPublicB,
      fixtureRoundId: ids.roundB,
      homeStageParticipantSlotId: ids.participantB,
      awayStageParticipantSlotId: ids.participantA,
      position: 2,
    },
  ])
  await database.insert(matches).values([
    {
      id: ids.matchA,
      fixtureSlotId: ids.slotA,
      stageId: ids.stage,
      visibility: 'public',
      calendarUid: `query-${ids.matchA}`,
    },
    {
      id: ids.privateMatch,
      fixtureSlotId: ids.slotB,
      stageId: ids.stage,
      visibility: 'private',
      calendarUid: `query-${ids.privateMatch}`,
    },
    {
      id: ids.publicMatchB,
      fixtureSlotId: ids.slotPublicB,
      stageId: ids.stage,
      visibility: 'public',
      calendarUid: `query-${ids.publicMatchB}`,
    },
  ])
  await database.insert(matchParticipantAssignments).values([
    {
      id: ids.assignmentHome,
      matchId: ids.matchA,
      role: 'home',
      seasonEntryId: ids.entryA,
      reason: 'Synthetic fixture',
      actorId,
    },
    {
      id: ids.assignmentAway,
      matchId: ids.matchA,
      role: 'away',
      seasonEntryId: ids.entryB,
      reason: 'Synthetic fixture',
      actorId,
    },
    {
      id: ids.privateAssignmentHome,
      matchId: ids.publicMatchB,
      role: 'home',
      seasonEntryId: ids.entryPrivate,
      reason: 'Synthetic fixture',
      actorId,
    },
    {
      id: ids.publicAssignmentAway,
      matchId: ids.publicMatchB,
      role: 'away',
      seasonEntryId: ids.entryA,
      reason: 'Synthetic fixture',
      actorId,
    },
  ])
  await database
    .update(matches)
    .set({
      currentHomeAssignmentId: ids.privateAssignmentHome,
      currentAwayAssignmentId: ids.publicAssignmentAway,
    })
    .where(eq(matches.id, ids.publicMatchB))
  await database.insert(matchScheduleRevisions).values({
    id: ids.schedule,
    matchId: ids.matchA,
    kickoffOn: '2026-09-01',
    kickoffAtLocal: '16:00:00',
    timezone: 'Europe/Kyiv',
    kickoffAtUtc: new Date('2026-09-01T13:00:00.000Z'),
    venueDesignation: 'home',
    homeAssignmentId: ids.assignmentHome,
    awayAssignmentId: ids.assignmentAway,
    internalReason: 'Synthetic publication',
    actorId,
    publishedAt: new Date('2026-08-01T12:00:00.000Z'),
  })
  await database.insert(playedScoreVersions).values({
    id: ids.playedScore,
    matchId: ids.matchA,
    homeRegulationGoals: 2,
    awayRegulationGoals: 1,
    actorId,
  })
  await database.insert(matchResultVersions).values({
    id: ids.playedResult,
    matchId: ids.matchA,
    versionNumber: 1,
    playedScoreVersionId: ids.playedScore,
    homeAssignmentId: ids.assignmentHome,
    awayAssignmentId: ids.assignmentAway,
    confirmedAt: new Date('2026-09-01T15:00:00.000Z'),
    confirmedByActorId: actorId,
  })
  await database
    .update(matches)
    .set({
      sportingState: 'finished',
      currentHomeAssignmentId: ids.assignmentHome,
      currentAwayAssignmentId: ids.assignmentAway,
      currentScheduleRevisionId: ids.schedule,
      currentResultVersionId: ids.playedResult,
    })
    .where(eq(matches.id, ids.matchA))
  await database.insert(rankingRuleSets).values({
    id: ids.rankingRules,
    stageVersionId: ids.stageVersion,
    validationHash: 'synthetic-rules',
  })
  await database.insert(pointsSchemes).values({
    id: ids.points,
    rankingRuleSetId: ids.rankingRules,
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
  })
  await database.insert(tieBreakers).values({
    id: ids.tieBreaker,
    rankingRuleSetId: ids.rankingRules,
    position: 1,
    criterion: 'goal_difference',
  })
  await database.insert(standingAdjustmentDecisions).values([
    {
      id: ids.publicAdjustment,
      stageId: ids.stage,
      seasonEntryId: ids.entryA,
      action: 'apply',
      pointsDelta: -2,
      effectiveOn: '2026-09-02',
      reason: 'Synthetic public adjustment',
      actorId,
    },
    {
      id: ids.privateAdjustment,
      stageId: ids.stage,
      seasonEntryId: ids.entryPrivate,
      action: 'apply',
      pointsDelta: -1,
      effectiveOn: '2026-09-02',
      reason: 'Synthetic private adjustment',
      actorId,
    },
  ])

  const competitionsList = await queries.listCompetitions()
  assert.deepEqual(
    competitionsList.filter((competition) => competition.id === ids.competition),
    [{ id: ids.competition, name: 'Public Cup' }],
  )
  assert.equal(await queries.getSeasonContent(ids.competition, ids.privateSeason), null)
  assert.equal(
    await queries.getSeasonContent(ids.privateCompetition, ids.seasonOfPrivateCompetition),
    null,
  )
  assert.equal(await queries.getSeasonContent(ids.competition, uid(999)), null)
  const empty = await queries.getSeasonContent(ids.competition, ids.emptySeason)
  assert.deepEqual(empty?.entries, [])
  assert.deepEqual(empty?.fixtureRounds, [])

  const standingsQueries = createPublicSeasonStandingsQueries(database)
  assert.equal(await standingsQueries.getStandingsInputs(ids.competition, ids.privateSeason), null)
  assert.equal(
    await standingsQueries.getStandingsInputs(
      ids.privateCompetition,
      ids.seasonOfPrivateCompetition,
    ),
    null,
  )
  assert.equal(await standingsQueries.getStandingsInputs(ids.competition, uid(999)), null)
  assert.deepEqual(
    (await standingsQueries.getStandingsInputs(ids.competition, ids.emptySeason))?.standingsInputs,
    [],
  )

  // Exercise real PostgreSQL reads with standings-table access denied at the database seam.
  let contentStatementCount = 0
  const contentOnlyDatabase = drizzle({
    client,
    logger: {
      logQuery(query) {
        contentStatementCount += 1
        if (
          /"(?:ranking_rule_sets|points_schemes|tie_breakers|standing_adjustment_decisions)"/.test(
            query,
          )
        ) {
          throw new Error('Standings tables are unavailable to the content reader')
        }
      },
    },
  })
  const contentOnlyQueries = createPublicSeasonContentQueries(contentOnlyDatabase)
  const independentContent = await contentOnlyQueries.getSeasonContent(ids.competition, ids.season)
  assert.ok(independentContent)
  console.info(
    `Public Season content completed with ${contentStatementCount} SQL statements and no Standings reads`,
  )

  const path = await queries.getSeasonContent(ids.competition, ids.season)
  assert(path)
  assert.deepEqual(independentContent, path)
  assert.equal(path.entries.length, 2)
  assert(!JSON.stringify(path).includes('Secret Team'))
  assert.equal(path.fixtureRounds.length, 1)
  assert.equal(path.fixtureRounds[0].matches.length, 1)
  assert(!JSON.stringify(path).includes(ids.publicMatchB))
  assert.equal(path.fixtureRounds[0].matches[0].result?.kind, 'played')
  assert.equal(path.fixtureRounds[0].matches[0].kickoffOn, '2026-09-01')
  const standings = await createPublicSeasonStandingsQueries(database).getStandingsInputs(
    ids.competition,
    ids.season,
  )
  assert(standings)
  assert.equal(standings.standingsInputs[0].publishedResults[0].homeGoals, 2)
  assert.equal(standings.standingsInputs[0].pointsScheme?.win, 3)
  assert.deepEqual(standings.standingsInputs[0].tieBreakers, [
    { position: 1, criterion: 'goal_difference', direction: 'desc' },
  ])
  assert.equal(standings.standingsInputs[0].adjustmentDecisions.length, 1)
  assert.equal(standings.standingsInputs[0].adjustmentDecisions[0].pointsDelta, -2)
  assert.deepEqual(JSON.parse(JSON.stringify(path)), path)
  assert.deepEqual(JSON.parse(JSON.stringify(standings)), standings)

  for (const invalidState of [
    { field: 'participation_state', label: 'participation' },
    { field: 'sporting_state', label: 'match sporting' },
  ]) {
    // Corrupt only the external database response; PostgreSQL constraints stay intact.
    const invalidStateClient = new Proxy(client, {
      get(target, property) {
        if (property !== 'query') return Reflect.get(target, property, target)
        return async (config: pg.QueryConfig, values?: unknown[]) => {
          const result = await target.query(config, values)
          const isTargetQuery =
            invalidState.field === 'participation_state' || config.text.includes('"matches"')
          const stateIndex = result.fields.findIndex((field) => field.name === invalidState.field)
          if (isTargetQuery && stateIndex >= 0) {
            for (const row of result.rows) row[stateIndex] = 'unsupported_state'
          }
          return result
        }
      },
    })
    await assert.rejects(
      createPublicSeasonContentQueries(drizzle({ client: invalidStateClient })).getSeasonContent(
        ids.competition,
        ids.season,
      ),
      new RegExp(`Invalid public ${invalidState.label} state`),
    )
  }

  await database.insert(resultRulings).values({
    id: ids.ruling,
    matchId: ids.matchA,
    action: 'assign',
    reason: 'Synthetic ruling',
    decidedOn: '2026-09-02',
    actorId,
  })
  await database.insert(technicalResults).values({
    id: ids.technicalScore,
    matchId: ids.matchA,
    rulingId: ids.ruling,
    homeGoals: 0,
    awayGoals: 3,
  })
  await database.insert(matchResultVersions).values({
    id: ids.technicalResult,
    matchId: ids.matchA,
    versionNumber: 2,
    technicalResultId: ids.technicalScore,
    homeAssignmentId: ids.assignmentHome,
    awayAssignmentId: ids.assignmentAway,
    confirmedAt: new Date('2026-09-02T15:00:00.000Z'),
    confirmedByActorId: actorId,
    supersedesResultId: ids.playedResult,
  })
  await database
    .update(matches)
    .set({ currentResultVersionId: ids.technicalResult })
    .where(and(eq(matches.id, ids.matchA), eq(matches.currentResultVersionId, ids.playedResult)))
  const corrected = await queries.getSeasonContent(ids.competition, ids.season)
  assert.equal(corrected?.fixtureRounds[0].matches[0].result?.kind, 'technical')
  const correctedStandings = await createPublicSeasonStandingsQueries(database).getStandingsInputs(
    ids.competition,
    ids.season,
  )
  assert.equal(correctedStandings?.standingsInputs[0].publishedResults[0].homeGoals, 0)
  assert.equal(correctedStandings?.standingsInputs[0].publishedResults[0].awayGoals, 3)

  console.log(
    'Public Query Layer visibility, current-result, empty/missing, and serialization checks passed',
  )
} finally {
  await client.query('ROLLBACK')
  client.release()
  await databasePool.end()
}
