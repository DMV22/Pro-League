import 'server-only'

import {
  calculateProvisionalLeagueStandings,
  type ProvisionalLeagueStandings,
} from '../../modules/standings-progression/domain/provisional-league-standings'
import { getDatabase } from '../db/client'
import type { Database } from '../db/transaction-types'
import { createPublicSeasonStandingsQueries } from './public-season-path'

export type PublicLeagueStandings = { asOf: string; stages: ProvisionalLeagueStandings[] }

/** Owns the snapshot; callers never coordinate SELECTs, dates or ranking rules. */
export function createPublicLeagueStandingsQuery(database: Pick<Database, 'transaction'>) {
  return {
    async getStandings(
      competitionId: string,
      seasonId: string,
      now = new Date(),
    ): Promise<PublicLeagueStandings | null> {
      const inputs = await database.transaction(
        (transaction) =>
          createPublicSeasonStandingsQueries(transaction).getStandingsInputs(
            competitionId,
            seasonId,
          ),
        { isolationLevel: 'repeatable read', accessMode: 'read only' },
      )
      if (!inputs) return null
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: inputs.season.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(now)
      const part = (name: Intl.DateTimeFormatPartTypes) =>
        parts.find((item) => item.type === name)!.value
      const asOf = `${part('year')}-${part('month')}-${part('day')}`
      return {
        asOf,
        stages: inputs.standingsInputs.map((input) =>
          calculateProvisionalLeagueStandings(input, asOf),
        ),
      }
    },
  }
}

export function getRuntimePublicLeagueStandingsQuery() {
  return createPublicLeagueStandingsQuery(getDatabase())
}
