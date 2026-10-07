import 'server-only'

import { and, asc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { cache } from 'react'

import type {
  PublicCompetitionNavigation,
  PublicNavigationQueries,
  PublicSeasonNavigation,
} from '../../application/queries/public-navigation'
import {
  competitions,
  competitionSlugs,
  seasons,
  seasonSlugs,
} from '../../modules/competition/infrastructure/schema'
import { getDatabase } from '../db/client'
import type { Database } from '../db/transaction-types'

type ReadExecutor = Pick<Database, 'select'>

const currentCompetitionSlugs = alias(competitionSlugs, 'public_current_competition_slugs')
const currentSeasonSlugs = alias(seasonSlugs, 'public_current_season_slugs')

function normalizeSlug(slug: string): string {
  return slug.normalize('NFKC').trim().toLowerCase()
}

function competitionPath(slug: string): string {
  return `/competitions/${encodeURIComponent(slug)}`
}

function seasonPath(competitionSlug: string, seasonSlug: string): string {
  return `${competitionPath(competitionSlug)}/seasons/${encodeURIComponent(seasonSlug)}`
}

export function createPublicNavigationQueries(database: ReadExecutor): PublicNavigationQueries {
  return {
    async listCompetitions() {
      const rows = await database
        .select({
          id: competitions.id,
          name: competitions.displayName,
          description: competitions.description,
          slug: currentCompetitionSlugs.displaySlug,
        })
        .from(competitions)
        .innerJoin(
          currentCompetitionSlugs,
          and(
            eq(competitions.currentSlugId, currentCompetitionSlugs.id),
            eq(currentCompetitionSlugs.competitionId, competitions.id),
          ),
        )
        .where(eq(competitions.visibility, 'public'))
        .orderBy(asc(competitions.displayName), asc(competitions.id))

      return rows
    },
    async resolveCompetition(slug) {
      const [row] = await database
        .select({
          id: competitions.id,
          name: competitions.displayName,
          description: competitions.description,
          slug: currentCompetitionSlugs.displaySlug,
        })
        .from(competitionSlugs)
        .innerJoin(competitions, eq(competitionSlugs.competitionId, competitions.id))
        .innerJoin(
          currentCompetitionSlugs,
          and(
            eq(competitions.currentSlugId, currentCompetitionSlugs.id),
            eq(currentCompetitionSlugs.competitionId, competitions.id),
          ),
        )
        .where(
          and(
            eq(competitionSlugs.normalizedSlug, normalizeSlug(slug)),
            eq(competitions.visibility, 'public'),
          ),
        )
        .limit(1)

      if (!row) return { kind: 'notFound' }
      if (slug !== row.slug) {
        return { kind: 'redirect', pathname: competitionPath(row.slug) }
      }

      const seasonRows = await database
        .select({
          id: seasons.id,
          name: seasons.name,
          slug: currentSeasonSlugs.displaySlug,
          sportingState: seasons.sportingState,
          archiveState: seasons.archiveState,
          startsOn: seasons.startsOn,
          endsOn: seasons.endsOn,
        })
        .from(seasons)
        .innerJoin(
          currentSeasonSlugs,
          and(
            eq(seasons.currentSlugId, currentSeasonSlugs.id),
            eq(currentSeasonSlugs.seasonId, seasons.id),
            eq(currentSeasonSlugs.competitionId, row.id),
          ),
        )
        .where(and(eq(seasons.competitionId, row.id), eq(seasons.visibility, 'public')))
        .orderBy(asc(seasons.startsOn), asc(seasons.name), asc(seasons.id))

      const competition: PublicCompetitionNavigation = row
      const publicSeasons: PublicSeasonNavigation[] = seasonRows
      return { kind: 'found', value: { competition, seasons: publicSeasons } }
    },
    async resolveSeason(competitionSlug, seasonSlug) {
      const [row] = await database
        .select({
          competitionId: competitions.id,
          competitionName: competitions.displayName,
          competitionDescription: competitions.description,
          competitionSlug: currentCompetitionSlugs.displaySlug,
          seasonId: seasons.id,
          seasonName: seasons.name,
          seasonSlug: currentSeasonSlugs.displaySlug,
          sportingState: seasons.sportingState,
          archiveState: seasons.archiveState,
          startsOn: seasons.startsOn,
          endsOn: seasons.endsOn,
        })
        .from(competitionSlugs)
        .innerJoin(competitions, eq(competitionSlugs.competitionId, competitions.id))
        .innerJoin(
          currentCompetitionSlugs,
          and(
            eq(competitions.currentSlugId, currentCompetitionSlugs.id),
            eq(currentCompetitionSlugs.competitionId, competitions.id),
          ),
        )
        .innerJoin(
          seasonSlugs,
          and(
            eq(seasonSlugs.competitionId, competitions.id),
            eq(seasonSlugs.normalizedSlug, normalizeSlug(seasonSlug)),
          ),
        )
        .innerJoin(
          seasons,
          and(
            eq(seasonSlugs.seasonId, seasons.id),
            eq(seasons.competitionId, competitions.id),
            eq(seasons.visibility, 'public'),
          ),
        )
        .innerJoin(
          currentSeasonSlugs,
          and(
            eq(seasons.currentSlugId, currentSeasonSlugs.id),
            eq(currentSeasonSlugs.seasonId, seasons.id),
            eq(currentSeasonSlugs.competitionId, competitions.id),
          ),
        )
        .where(
          and(
            eq(competitionSlugs.normalizedSlug, normalizeSlug(competitionSlug)),
            eq(competitions.visibility, 'public'),
          ),
        )
        .limit(1)

      if (!row) return { kind: 'notFound' }
      if (competitionSlug !== row.competitionSlug || seasonSlug !== row.seasonSlug) {
        return {
          kind: 'redirect',
          pathname: seasonPath(row.competitionSlug, row.seasonSlug),
        }
      }

      return {
        kind: 'found',
        value: {
          competition: {
            id: row.competitionId,
            name: row.competitionName,
            description: row.competitionDescription,
            slug: row.competitionSlug,
          },
          season: {
            id: row.seasonId,
            name: row.seasonName,
            slug: row.seasonSlug,
            sportingState: row.sportingState,
            archiveState: row.archiveState,
            startsOn: row.startsOn,
            endsOn: row.endsOn,
          },
        },
      }
    },
  }
}

export function hasPublicDatabaseConfiguration(): boolean {
  const url = process.env.DATABASE_URL?.trim()
  return Boolean(url && !url.includes('replace-with-a-private-local-password'))
}

export const listRuntimePublicCompetitions = cache(() =>
  createPublicNavigationQueries(getDatabase()).listCompetitions(),
)

export const resolveRuntimePublicCompetition = cache((slug: string) =>
  createPublicNavigationQueries(getDatabase()).resolveCompetition(slug),
)

export const resolveRuntimePublicSeason = cache((competitionSlug: string, seasonSlug: string) =>
  createPublicNavigationQueries(getDatabase()).resolveSeason(competitionSlug, seasonSlug),
)
