export type LeagueStandingsInput = {
  stageId: string
  stageVersionId: string
  stageName: string
  /** A complete Stage cannot be projected safely (unresolved/private inputs). */
  inputUnavailable: boolean
  participants: Array<{
    seasonEntryId: string
    teamId: string
    teamName: string
    participationState: string
  }>
  rankingRuleSetId: string | null
  pointsScheme: { win: number; draw: number; loss: number } | null
  tieBreakers: Array<{ position: number; criterion: string; direction: string }>
  adjustmentDecisions: Array<{
    id: string
    seasonEntryId: string
    action: string
    pointsDelta: number | null
    effectiveOn: string
    supersedesDecisionId: string | null
  }>
  publishedResults: Array<{
    matchId: string
    resultVersionId: string
    homeSeasonEntryId: string
    awaySeasonEntryId: string
    homeGoals: number
    awayGoals: number
  }>
}

export type LeagueStandingRow = LeagueStandingsInput['participants'][number] & {
  position: number
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  adjustment: number
  points: number
}

export type ProvisionalLeagueStandings = { stageId: string; stageName: string } & (
  | { kind: 'available'; rows: LeagueStandingRow[] }
  | {
      kind: 'unavailable'
      reason:
        | 'incomplete_inputs'
        | 'unsupported_rules'
        | 'unsupported_participation'
        | 'invalid_adjustments'
    }
)

/** Pure M3 projection, not an official finalization/ranking engine. asOf is a civil ISO date. */
export function calculateProvisionalLeagueStandings(
  input: LeagueStandingsInput,
  asOf: string,
): ProvisionalLeagueStandings {
  const stage = { stageId: input.stageId, stageName: input.stageName }
  const rows: LeagueStandingRow[] = input.participants.map((participant) => ({
    ...participant,
    position: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    adjustment: 0,
    points: 0,
  }))
  const byEntry = new Map(rows.map((row) => [row.seasonEntryId, row]))
  if (input.inputUnavailable || rows.length === 0 || byEntry.size !== rows.length)
    return { ...stage, kind: 'unavailable', reason: 'incomplete_inputs' }
  const scheme = input.pointsScheme
  if (!input.rankingRuleSetId || !scheme)
    return { ...stage, kind: 'unavailable', reason: 'unsupported_rules' }
  const supportedCriteria = new Map<string, keyof LeagueStandingRow>([
    ['goal_difference', 'goalDifference'],
    ['goals_scored', 'goalsFor'],
    ['wins', 'wins'],
  ])
  const criteria = [...input.tieBreakers].sort((a, b) => a.position - b.position)
  if (
    criteria.some(
      (item) => !supportedCriteria.has(item.criterion) || !['asc', 'desc'].includes(item.direction),
    ) ||
    Object.values(scheme).some((points) => !Number.isSafeInteger(points))
  )
    return { ...stage, kind: 'unavailable', reason: 'unsupported_rules' }
  if (rows.some((row) => row.participationState !== 'registered'))
    return { ...stage, kind: 'unavailable', reason: 'unsupported_participation' }
  const decisions = new Map(input.adjustmentDecisions.map((decision) => [decision.id, decision]))
  const successor = new Map<string, string>()
  if (decisions.size !== input.adjustmentDecisions.length)
    return { ...stage, kind: 'unavailable', reason: 'invalid_adjustments' }
  for (const decision of decisions.values()) {
    const previous = decision.supersedesDecisionId
      ? decisions.get(decision.supersedesDecisionId)
      : null
    if (
      !byEntry.has(decision.seasonEntryId) ||
      !['apply', 'replace', 'revoke'].includes(decision.action) ||
      (decision.action === 'apply' ? !!decision.supersedesDecisionId : !previous) ||
      (decision.action === 'revoke'
        ? decision.pointsDelta !== null
        : !Number.isSafeInteger(decision.pointsDelta) || decision.pointsDelta === 0) ||
      (previous &&
        (previous.seasonEntryId !== decision.seasonEntryId ||
          previous.effectiveOn > decision.effectiveOn)) ||
      (decision.supersedesDecisionId && successor.has(decision.supersedesDecisionId))
    )
      return { ...stage, kind: 'unavailable', reason: 'invalid_adjustments' }
    if (decision.supersedesDecisionId) successor.set(decision.supersedesDecisionId, decision.id)
    const visited = new Set<string>([decision.id])
    let ancestor = previous
    while (ancestor) {
      if (visited.has(ancestor.id))
        return { ...stage, kind: 'unavailable', reason: 'invalid_adjustments' }
      visited.add(ancestor.id)
      ancestor = ancestor.supersedesDecisionId ? decisions.get(ancestor.supersedesDecisionId) : null
    }
  }
  for (const decision of decisions.values()) {
    if (decision.effectiveOn > asOf) continue
    const nextId = successor.get(decision.id)
    if (nextId && decisions.get(nextId)!.effectiveOn <= asOf) continue
    if (decision.action !== 'revoke') {
      const row = byEntry.get(decision.seasonEntryId)!
      row.adjustment += decision.pointsDelta!
      row.points += decision.pointsDelta!
    }
  }
  const countedMatches = new Set<string>()
  for (const result of input.publishedResults) {
    const home = byEntry.get(result.homeSeasonEntryId)
    const away = byEntry.get(result.awaySeasonEntryId)
    if (
      !home ||
      !away ||
      home === away ||
      countedMatches.has(result.matchId) ||
      [result.homeGoals, result.awayGoals].some(
        (goals) => !Number.isSafeInteger(goals) || goals < 0,
      )
    )
      return { ...stage, kind: 'unavailable', reason: 'incomplete_inputs' }
    countedMatches.add(result.matchId)
    for (const [row, scored, conceded] of [
      [home, result.homeGoals, result.awayGoals],
      [away, result.awayGoals, result.homeGoals],
    ] as const) {
      row.played++
      row.goalsFor += scored
      row.goalsAgainst += conceded
      row.goalDifference = row.goalsFor - row.goalsAgainst
      if (scored > conceded) {
        row.wins++
        row.points += scheme.win
      } else if (scored < conceded) {
        row.losses++
        row.points += scheme.loss
      } else {
        row.draws++
        row.points += scheme.draw
      }
    }
  }
  const compare = (a: LeagueStandingRow, b: LeagueStandingRow): number => {
    if (a.points !== b.points) return b.points - a.points
    for (const item of criteria) {
      const key = supportedCriteria.get(item.criterion)!
      const difference = Number(a[key]) - Number(b[key])
      if (difference) return item.direction === 'asc' ? difference : -difference
    }
    return 0
  }
  // Input order stabilizes presentation only; tied teams retain the same sporting position.
  rows.sort(compare)
  rows.forEach((row, index) => {
    row.position =
      index > 0 && compare(rows[index - 1], row) === 0 ? rows[index - 1].position : index + 1
  })
  return { ...stage, kind: 'available', rows }
}
