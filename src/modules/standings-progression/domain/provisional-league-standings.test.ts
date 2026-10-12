import { describe, expect, it } from 'vitest'

import {
  calculateProvisionalLeagueStandings,
  type LeagueStandingsInput,
} from './provisional-league-standings'

function input(): LeagueStandingsInput {
  return {
    stageId: 'league',
    stageVersionId: 'v1',
    stageName: 'Ліга',
    inputUnavailable: false,
    participants: ['a', 'b', 'c'].map((id) => ({
      seasonEntryId: id,
      teamId: id,
      teamName: id,
      participationState: 'registered',
    })),
    rankingRuleSetId: 'rules',
    pointsScheme: { win: 3, draw: 1, loss: 0 },
    tieBreakers: [{ position: 1, criterion: 'goal_difference', direction: 'desc' }],
    adjustmentDecisions: [],
    publishedResults: [
      {
        matchId: 'm1',
        resultVersionId: 'r1',
        homeSeasonEntryId: 'a',
        awaySeasonEntryId: 'b',
        homeGoals: 0,
        awayGoals: 3,
      },
    ],
  }
}

describe('provisional League Standings', () => {
  it('uses competition ranking positions 1, 1, 3 and leaves source inputs untouched', () => {
    const source = input()
    source.publishedResults = [
      {
        matchId: 'm1',
        resultVersionId: 'r1',
        homeSeasonEntryId: 'a',
        awaySeasonEntryId: 'c',
        homeGoals: 1,
        awayGoals: 0,
      },
      {
        matchId: 'm2',
        resultVersionId: 'r2',
        homeSeasonEntryId: 'b',
        awaySeasonEntryId: 'c',
        homeGoals: 1,
        awayGoals: 0,
      },
    ]
    const original = structuredClone(source)
    const result = calculateProvisionalLeagueStandings(source, '2026-04-07')
    expect(result.kind === 'available' && result.rows.map((row) => row.position)).toEqual([1, 1, 3])
    expect(source).toEqual(original)
  })
  it.each(['cycle', 'branch', 'cross_entry'] as const)(
    'refuses a %s in adjustment history',
    (invalidHistory) => {
      const source = input()
      source.adjustmentDecisions = [
        {
          id: 'd1',
          seasonEntryId: 'a',
          action: 'apply',
          pointsDelta: -1,
          effectiveOn: '2026-04-01',
          supersedesDecisionId: null,
        },
        {
          id: 'd2',
          seasonEntryId: 'a',
          action: 'replace',
          pointsDelta: -2,
          effectiveOn: '2026-04-01',
          supersedesDecisionId: 'd1',
        },
      ]
      if (invalidHistory === 'cycle') {
        source.adjustmentDecisions[0].action = 'replace'
        source.adjustmentDecisions[0].supersedesDecisionId = 'd2'
      } else if (invalidHistory === 'branch')
        source.adjustmentDecisions.push({ ...source.adjustmentDecisions[1], id: 'd3' })
      else source.adjustmentDecisions[1].seasonEntryId = 'b'
      expect(calculateProvisionalLeagueStandings(source, '2026-04-07')).toMatchObject({
        kind: 'unavailable',
        reason: 'invalid_adjustments',
      })
    },
  )
  it('refuses partial, duplicate or malformed result inputs instead of publishing misleading totals', () => {
    const source = input()
    source.publishedResults.push({ ...source.publishedResults[0], resultVersionId: 'old' })
    expect(calculateProvisionalLeagueStandings(source, '2026-04-07')).toMatchObject({
      kind: 'unavailable',
      reason: 'incomplete_inputs',
    })
    source.publishedResults.pop()
    source.publishedResults[0].homeGoals = -1
    expect(calculateProvisionalLeagueStandings(source, '2026-04-07')).toMatchObject({
      kind: 'unavailable',
      reason: 'incomplete_inputs',
    })
  })
  it('honours a custom points scheme and configured ascending tie-breaker', () => {
    const source = input()
    source.pointsScheme = { win: 5, draw: 2, loss: 1 }
    source.publishedResults.push({
      matchId: 'm2',
      resultVersionId: 'r2',
      homeSeasonEntryId: 'b',
      awaySeasonEntryId: 'c',
      homeGoals: 2,
      awayGoals: 2,
    })
    const result = calculateProvisionalLeagueStandings(source, '2026-04-07')
    expect(
      result.kind === 'available' &&
        result.rows.map((row) => [row.seasonEntryId, row.points, row.draws]),
    ).toEqual([
      ['b', 7, 1],
      ['c', 2, 1],
      ['a', 1, 0],
    ])
    source.pointsScheme = { win: 0, draw: 0, loss: 0 }
    source.tieBreakers = [{ position: 1, criterion: 'goals_scored', direction: 'asc' }]
    const ascending = calculateProvisionalLeagueStandings(source, '2026-04-07')
    expect(
      ascending.kind === 'available' && ascending.rows.map((row) => row.seasonEntryId),
    ).toEqual(['a', 'c', 'b'])
  })
  it('uses only the effective terminal adjustment, then removes it after revocation', () => {
    const source = input()
    source.adjustmentDecisions = [
      {
        id: 'd1',
        seasonEntryId: 'b',
        action: 'apply',
        pointsDelta: -1,
        effectiveOn: '2026-04-01',
        supersedesDecisionId: null,
      },
      {
        id: 'd2',
        seasonEntryId: 'b',
        action: 'replace',
        pointsDelta: -2,
        effectiveOn: '2026-04-08',
        supersedesDecisionId: 'd1',
      },
      {
        id: 'd3',
        seasonEntryId: 'b',
        action: 'revoke',
        pointsDelta: null,
        effectiveOn: '2026-04-09',
        supersedesDecisionId: 'd2',
      },
    ]
    const points = (date: string) => {
      const result = calculateProvisionalLeagueStandings(source, date)
      return result.kind === 'available'
        ? result.rows.find((row) => row.seasonEntryId === 'b')?.points
        : null
    }
    expect(points('2026-04-07')).toBe(2)
    expect(points('2026-04-08')).toBe(1)
    expect(points('2026-04-09')).toBe(3)
    source.adjustmentDecisions[1].supersedesDecisionId = 'missing'
    expect(calculateProvisionalLeagueStandings(source, '2026-04-09')).toMatchObject({
      kind: 'unavailable',
      reason: 'invalid_adjustments',
    })
  })
  it('keeps shared positions after configured tie-breakers without an arbitrary winner', () => {
    const source = input()
    source.publishedResults = []
    const result = calculateProvisionalLeagueStandings(source, '2026-04-07')
    expect(result.kind === 'available' && result.rows.map((row) => row.position)).toEqual([1, 1, 1])
  })
  it('refuses unsupported criteria and participation consequences', () => {
    const source = input()
    source.tieBreakers[0].criterion = 'head_to_head'
    expect(calculateProvisionalLeagueStandings(source, '2026-04-07')).toMatchObject({
      kind: 'unavailable',
      reason: 'unsupported_rules',
    })
    source.tieBreakers = []
    source.participants[0].participationState = 'withdrawn'
    expect(calculateProvisionalLeagueStandings(source, '2026-04-07')).toMatchObject({
      kind: 'unavailable',
      reason: 'unsupported_participation',
    })
  })
  it('ranks a technical score and includes an assigned team without matches', () => {
    const result = calculateProvisionalLeagueStandings(input(), '2026-04-07')
    expect(result.kind).toBe('available')
    if (result.kind !== 'available') throw new Error('Expected standings')
    expect(
      result.rows.map(
        ({ seasonEntryId, position, played, wins, losses, goalsFor, goalsAgainst, points }) => ({
          seasonEntryId,
          position,
          played,
          wins,
          losses,
          goalsFor,
          goalsAgainst,
          points,
        }),
      ),
    ).toEqual([
      {
        seasonEntryId: 'b',
        position: 1,
        played: 1,
        wins: 1,
        losses: 0,
        goalsFor: 3,
        goalsAgainst: 0,
        points: 3,
      },
      {
        seasonEntryId: 'c',
        position: 2,
        played: 0,
        wins: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      },
      {
        seasonEntryId: 'a',
        position: 3,
        played: 1,
        wins: 0,
        losses: 1,
        goalsFor: 0,
        goalsAgainst: 3,
        points: 0,
      },
    ])
  })
})
