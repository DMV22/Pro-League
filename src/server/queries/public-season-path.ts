import 'server-only'

import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import type {
  PublicFixtureRound,
  PublicMatch,
  PublicMatchParticipant,
  PublicMatchResult,
  PublicSeasonPathQueries,
  PublicStandingsInput,
} from '../../application/queries/public-season-path'
import {
  competitions,
  competitionStages,
  competitionStageVersions,
  seasons,
} from '../../modules/competition/infrastructure/schema'
import {
  fixtureRounds,
  leagueFixtureSlots,
  matchParticipantAssignments,
  matches,
  matchResultVersions,
  matchScheduleRevisions,
  playedScoreVersions,
  technicalResults,
} from '../../modules/match/infrastructure/schema'
import { seasonEntries, teams } from '../../modules/registration/infrastructure/schema'
import {
  pointsSchemes,
  rankingRuleSets,
  standingAdjustmentDecisions,
  tieBreakers,
} from '../../modules/standings-progression/infrastructure/schema'
import { getDatabase } from '../db/client'
import type { Database } from '../db/transaction-types'

type ReadExecutor = Pick<Database, 'select'>

const homeAssignments = alias(matchParticipantAssignments, 'public_home_assignments')
const awayAssignments = alias(matchParticipantAssignments, 'public_away_assignments')
const homeEntries = alias(seasonEntries, 'public_home_entries')
const awayEntries = alias(seasonEntries, 'public_away_entries')
const homeTeams = alias(teams, 'public_home_teams')
const awayTeams = alias(teams, 'public_away_teams')

function publicParticipant(
  seasonEntryId: string | null,
  teamId: string | null,
  teamName: string | null,
): PublicMatchParticipant | null {
  return seasonEntryId && teamId && teamName ? { seasonEntryId, teamId, teamName } : null
}

type MatchRow = Awaited<ReturnType<typeof readPublishedRoundMatches>>[number]

function publicResult(row: MatchRow, hasPublicParticipants: boolean): PublicMatchResult | null {
  if (
    !hasPublicParticipants ||
    row.sportingState !== 'finished' ||
    !row.resultId ||
    !row.confirmedAt
  ) {
    return null
  }
  const confirmedAt = row.confirmedAt.toISOString()
  if (row.playedScoreId && row.homeRegulationGoals !== null && row.awayRegulationGoals !== null) {
    return {
      id: row.resultId,
      kind: 'played',
      confirmedAt,
      homeRegulationGoals: row.homeRegulationGoals,
      awayRegulationGoals: row.awayRegulationGoals,
      homeExtraTimeGoals: row.homeExtraTimeGoals,
      awayExtraTimeGoals: row.awayExtraTimeGoals,
    }
  }
  if (row.technicalResultId && row.technicalHomeGoals !== null && row.technicalAwayGoals !== null) {
    return {
      id: row.resultId,
      kind: 'technical',
      confirmedAt,
      homeGoals: row.technicalHomeGoals,
      awayGoals: row.technicalAwayGoals,
    }
  }
  return null
}

async function readPublishedRoundMatches(
  database: ReadExecutor,
  seasonId: string,
  formatVersionId: string,
) {
  return database
    .select({
      stageId: competitionStages.id,
      stageVersionId: competitionStageVersions.id,
      roundId: fixtureRounds.id,
      roundCode: fixtureRounds.code,
      roundPosition: fixtureRounds.position,
      matchId: matches.id,
      sportingState: matches.sportingState,
      homeEntryId: homeEntries.id,
      homeTeamId: homeTeams.id,
      homeTeamName: homeTeams.displayName,
      awayEntryId: awayEntries.id,
      awayTeamId: awayTeams.id,
      awayTeamName: awayTeams.displayName,
      kickoffOn: matchScheduleRevisions.kickoffOn,
      kickoffAtLocal: matchScheduleRevisions.kickoffAtLocal,
      timezone: matchScheduleRevisions.timezone,
      resultId: matchResultVersions.id,
      confirmedAt: matchResultVersions.confirmedAt,
      playedScoreId: playedScoreVersions.id,
      homeRegulationGoals: playedScoreVersions.homeRegulationGoals,
      awayRegulationGoals: playedScoreVersions.awayRegulationGoals,
      homeExtraTimeGoals: playedScoreVersions.homeExtraTimeGoals,
      awayExtraTimeGoals: playedScoreVersions.awayExtraTimeGoals,
      technicalResultId: technicalResults.id,
      technicalHomeGoals: technicalResults.homeGoals,
      technicalAwayGoals: technicalResults.awayGoals,
    })
    .from(competitionStages)
    .innerJoin(
      competitionStageVersions,
      eq(competitionStages.currentVersionId, competitionStageVersions.id),
    )
    .innerJoin(
      fixtureRounds,
      and(
        eq(fixtureRounds.stageId, competitionStages.id),
        eq(fixtureRounds.stageVersionId, competitionStageVersions.id),
      ),
    )
    .innerJoin(leagueFixtureSlots, eq(leagueFixtureSlots.fixtureRoundId, fixtureRounds.id))
    .innerJoin(
      matches,
      and(
        eq(matches.fixtureSlotId, leagueFixtureSlots.fixtureSlotId),
        eq(matches.stageId, competitionStages.id),
        eq(matches.visibility, 'public'),
      ),
    )
    .leftJoin(
      matchResultVersions,
      and(
        eq(matches.currentResultVersionId, matchResultVersions.id),
        eq(matchResultVersions.matchId, matches.id),
      ),
    )
    .leftJoin(
      homeAssignments,
      and(
        eq(
          homeAssignments.id,
          sql<string>`coalesce(${matchResultVersions.homeAssignmentId}, ${matches.currentHomeAssignmentId})`,
        ),
        eq(homeAssignments.matchId, matches.id),
      ),
    )
    .leftJoin(
      awayAssignments,
      and(
        eq(
          awayAssignments.id,
          sql<string>`coalesce(${matchResultVersions.awayAssignmentId}, ${matches.currentAwayAssignmentId})`,
        ),
        eq(awayAssignments.matchId, matches.id),
      ),
    )
    .leftJoin(
      homeEntries,
      and(eq(homeAssignments.seasonEntryId, homeEntries.id), eq(homeEntries.seasonId, seasonId)),
    )
    .leftJoin(
      awayEntries,
      and(eq(awayAssignments.seasonEntryId, awayEntries.id), eq(awayEntries.seasonId, seasonId)),
    )
    .leftJoin(
      homeTeams,
      and(eq(homeEntries.teamId, homeTeams.id), eq(homeTeams.visibility, 'public')),
    )
    .leftJoin(
      awayTeams,
      and(eq(awayEntries.teamId, awayTeams.id), eq(awayTeams.visibility, 'public')),
    )
    .leftJoin(
      matchScheduleRevisions,
      and(
        eq(matches.currentScheduleRevisionId, matchScheduleRevisions.id),
        eq(matchScheduleRevisions.matchId, matches.id),
      ),
    )
    .leftJoin(
      playedScoreVersions,
      and(
        eq(matchResultVersions.playedScoreVersionId, playedScoreVersions.id),
        eq(playedScoreVersions.matchId, matches.id),
      ),
    )
    .leftJoin(
      technicalResults,
      and(
        eq(matchResultVersions.technicalResultId, technicalResults.id),
        eq(technicalResults.matchId, matches.id),
      ),
    )
    .where(
      and(
        eq(competitionStages.seasonId, seasonId),
        eq(competitionStageVersions.formatVersionId, formatVersionId),
        eq(competitionStageVersions.formatType, 'league'),
      ),
    )
    .orderBy(
      asc(competitionStageVersions.position),
      asc(fixtureRounds.position),
      asc(leagueFixtureSlots.position),
    )
}

export function createPublicSeasonPathQueries(database: ReadExecutor): PublicSeasonPathQueries {
  return {
    async listCompetitions() {
      const rows = await database
        .select({ id: competitions.id, name: competitions.displayName })
        .from(competitions)
        .where(eq(competitions.visibility, 'public'))
        .orderBy(asc(competitions.displayName), asc(competitions.id))
      return rows.map((row) => ({ id: row.id, name: row.name }))
    },
    async getSeasonPath(competitionId, seasonId) {
      const [parent] = await database
        .select({
          competitionId: competitions.id,
          competitionName: competitions.displayName,
          seasonId: seasons.id,
          seasonName: seasons.name,
          sportingState: seasons.sportingState,
          timezone: seasons.timezone,
          formatVersionId: seasons.currentFormatVersionId,
        })
        .from(seasons)
        .innerJoin(competitions, eq(seasons.competitionId, competitions.id))
        .where(
          and(
            eq(competitions.id, competitionId),
            eq(competitions.visibility, 'public'),
            eq(seasons.id, seasonId),
            eq(seasons.visibility, 'public'),
          ),
        )
      if (!parent) return null

      const entryRows = await database
        .select({
          id: seasonEntries.id,
          teamId: teams.id,
          teamName: teams.displayName,
          participationState: seasonEntries.participationState,
        })
        .from(seasonEntries)
        .innerJoin(teams, and(eq(seasonEntries.teamId, teams.id), eq(teams.visibility, 'public')))
        .where(eq(seasonEntries.seasonId, seasonId))
        .orderBy(asc(teams.displayName), asc(seasonEntries.id))

      const fixtureRoundsById = new Map<string, PublicFixtureRound>()
      const standingsByStageId = new Map<string, PublicStandingsInput>()
      if (parent.formatVersionId) {
        const matchRows = await readPublishedRoundMatches(
          database,
          seasonId,
          parent.formatVersionId,
        )
        for (const row of matchRows) {
          let round = fixtureRoundsById.get(row.roundId)
          if (!round) {
            round = {
              id: row.roundId,
              stageId: row.stageId,
              code: row.roundCode,
              position: row.roundPosition,
              matches: [],
            }
            fixtureRoundsById.set(row.roundId, round)
          }
          if (!standingsByStageId.has(row.stageId)) {
            standingsByStageId.set(row.stageId, {
              stageId: row.stageId,
              stageVersionId: row.stageVersionId,
              rankingRuleSetId: null,
              pointsScheme: null,
              tieBreakers: [],
              adjustmentDecisions: [],
              publishedResults: [],
            })
          }
          const home = publicParticipant(row.homeEntryId, row.homeTeamId, row.homeTeamName)
          const away = publicParticipant(row.awayEntryId, row.awayTeamId, row.awayTeamName)
          const result = publicResult(row, Boolean(home && away))
          const match: PublicMatch = {
            id: row.matchId,
            sportingState: row.sportingState,
            home,
            away,
            kickoffOn: row.kickoffOn,
            kickoffAtLocal: row.kickoffAtLocal,
            timezone: row.timezone,
            result,
          }
          round.matches.push(match)
          if (result && home && away) {
            const input = standingsByStageId.get(row.stageId)!
            input.publishedResults.push({
              matchId: row.matchId,
              resultVersionId: result.id,
              homeSeasonEntryId: home.seasonEntryId,
              awaySeasonEntryId: away.seasonEntryId,
              homeGoals:
                result.kind === 'technical'
                  ? result.homeGoals
                  : result.homeRegulationGoals + (result.homeExtraTimeGoals ?? 0),
              awayGoals:
                result.kind === 'technical'
                  ? result.awayGoals
                  : result.awayRegulationGoals + (result.awayExtraTimeGoals ?? 0),
            })
          }
        }

        const stageVersionIds = [...standingsByStageId.values()].map(
          (input) => input.stageVersionId,
        )
        if (stageVersionIds.length > 0) {
          const rules = await database
            .select({
              stageVersionId: rankingRuleSets.stageVersionId,
              rankingRuleSetId: rankingRuleSets.id,
              win: pointsSchemes.winPoints,
              draw: pointsSchemes.drawPoints,
              loss: pointsSchemes.lossPoints,
            })
            .from(rankingRuleSets)
            .leftJoin(pointsSchemes, eq(pointsSchemes.rankingRuleSetId, rankingRuleSets.id))
            .where(inArray(rankingRuleSets.stageVersionId, stageVersionIds))
          const inputsByVersion = new Map(
            [...standingsByStageId.values()].map((input) => [input.stageVersionId, input]),
          )
          for (const rule of rules) {
            const input = inputsByVersion.get(rule.stageVersionId)
            if (!input) continue
            input.rankingRuleSetId = rule.rankingRuleSetId
            if (rule.win !== null && rule.draw !== null && rule.loss !== null) {
              input.pointsScheme = { win: rule.win, draw: rule.draw, loss: rule.loss }
            }
          }
          const ruleSetIds = rules.map((rule) => rule.rankingRuleSetId)
          if (ruleSetIds.length > 0) {
            const orderedTieBreakers = await database
              .select({
                rankingRuleSetId: tieBreakers.rankingRuleSetId,
                position: tieBreakers.position,
                criterion: tieBreakers.criterion,
                direction: tieBreakers.direction,
              })
              .from(tieBreakers)
              .where(inArray(tieBreakers.rankingRuleSetId, ruleSetIds))
              .orderBy(asc(tieBreakers.position))
            const inputsByRuleSet = new Map(
              [...standingsByStageId.values()]
                .filter((input) => input.rankingRuleSetId !== null)
                .map((input) => [input.rankingRuleSetId, input]),
            )
            for (const item of orderedTieBreakers) {
              inputsByRuleSet.get(item.rankingRuleSetId)?.tieBreakers.push({
                position: item.position,
                criterion: item.criterion,
                direction: item.direction,
              })
            }
          }
          const adjustments = await database
            .select({
              id: standingAdjustmentDecisions.id,
              stageId: standingAdjustmentDecisions.stageId,
              seasonEntryId: standingAdjustmentDecisions.seasonEntryId,
              action: standingAdjustmentDecisions.action,
              pointsDelta: standingAdjustmentDecisions.pointsDelta,
              effectiveOn: standingAdjustmentDecisions.effectiveOn,
              supersedesDecisionId: standingAdjustmentDecisions.supersedesDecisionId,
            })
            .from(standingAdjustmentDecisions)
            .innerJoin(
              seasonEntries,
              and(
                eq(standingAdjustmentDecisions.seasonEntryId, seasonEntries.id),
                eq(seasonEntries.seasonId, seasonId),
              ),
            )
            .innerJoin(
              teams,
              and(eq(seasonEntries.teamId, teams.id), eq(teams.visibility, 'public')),
            )
            .where(inArray(standingAdjustmentDecisions.stageId, [...standingsByStageId.keys()]))
            .orderBy(
              asc(standingAdjustmentDecisions.effectiveOn),
              asc(standingAdjustmentDecisions.recordedAt),
              asc(standingAdjustmentDecisions.id),
            )
          for (const adjustment of adjustments) {
            standingsByStageId.get(adjustment.stageId)?.adjustmentDecisions.push({
              id: adjustment.id,
              seasonEntryId: adjustment.seasonEntryId,
              action: adjustment.action,
              pointsDelta: adjustment.pointsDelta,
              effectiveOn: adjustment.effectiveOn,
              supersedesDecisionId: adjustment.supersedesDecisionId,
            })
          }
        }
      }

      return {
        competition: { id: parent.competitionId, name: parent.competitionName },
        season: {
          id: parent.seasonId,
          name: parent.seasonName,
          sportingState: parent.sportingState,
          timezone: parent.timezone,
        },
        entries: entryRows.map((row) => ({
          id: row.id,
          teamId: row.teamId,
          teamName: row.teamName,
          participationState: row.participationState,
        })),
        fixtureRounds: [...fixtureRoundsById.values()],
        standingsInputs: [...standingsByStageId.values()],
      }
    },
  }
}

export function getRuntimePublicSeasonPathQueries(): PublicSeasonPathQueries {
  return createPublicSeasonPathQueries(getDatabase())
}
