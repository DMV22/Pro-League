import 'server-only'
import type { Database } from '../db/transaction-types'
import { createPublicProjectionStateQuery, projectionReadFailure } from './public-projection-state'
import { createPublicNavigationQueries } from './public-navigation'
import {
  createPublicSeasonContentQueries,
  createPublicSeasonStandingsQueries,
} from './public-season-path'
import { calculateProvisionalLeagueStandings } from '../../modules/standings-progression/domain/provisional-league-standings'
import {
  PublicProjectionChanged,
  type PublicProjectionRequest,
  type PublicProjectionSnapshot,
  type PublicProjectionState,
} from '../../application/queries/public-projections'

export function createPublicProjectionSnapshotQuery(database: Pick<Database, 'transaction'>) {
  return {
    async read(
      request: PublicProjectionRequest,
      expected: PublicProjectionState,
    ): Promise<PublicProjectionSnapshot> {
      try {
        return await database.transaction(
          async (transaction) => {
            const probe = await createPublicProjectionStateQuery(transaction).read(request)
            if (
              probe.kind !== 'found' ||
              probe.state.revision !== expected.revision ||
              probe.state.key !== expected.key ||
              probe.state.seasonDate !== expected.seasonDate
            )
              throw new PublicProjectionChanged()
            const navigation = createPublicNavigationQueries(transaction)
            if (request.kind === 'home')
              return {
                state: probe.state,
                payload: { kind: 'home', competitions: await navigation.listCompetitions() },
              }
            if (request.kind === 'competition') {
              const page = await navigation.resolveCompetition(request.competitionSlug)
              if (page.kind !== 'found') throw new PublicProjectionChanged()
              return { state: probe.state, payload: { kind: 'competition', ...page.value } }
            }
            const page = await navigation.resolveSeason(request.competitionSlug, request.seasonSlug)
            if (page.kind !== 'found') throw new PublicProjectionChanged()
            const content = await createPublicSeasonContentQueries(transaction).getSeasonContent(
              page.value.competition.id,
              page.value.season.id,
            )
            const inputs = await createPublicSeasonStandingsQueries(transaction).getStandingsInputs(
              page.value.competition.id,
              page.value.season.id,
            )
            if (!content || !inputs || !expected.seasonDate) throw new PublicProjectionChanged()
            return {
              state: probe.state,
              payload: {
                kind: 'season',
                ...page.value,
                content,
                standings: inputs.standingsInputs.map((input) =>
                  calculateProvisionalLeagueStandings(input, expected.seasonDate!),
                ),
              },
            }
          },
          { isolationLevel: 'repeatable read', accessMode: 'read only' },
        )
      } catch (error) {
        return projectionReadFailure(error)
      }
    },
  }
}
