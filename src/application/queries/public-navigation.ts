export type PublicCompetitionNavigation = {
  id: string
  name: string
  description: string | null
  slug: string
}

export type PublicSeasonNavigation = {
  id: string
  name: string
  slug: string
  sportingState: string
  archiveState: string
  startsOn: string | null
  endsOn: string | null
}

export type PublicCompetitionPage = {
  competition: PublicCompetitionNavigation
  seasons: PublicSeasonNavigation[]
}

export type PublicSeasonPage = {
  competition: PublicCompetitionNavigation
  season: PublicSeasonNavigation
}

export type PublicRouteResolution<T> =
  { kind: 'found'; value: T } | { kind: 'redirect'; pathname: string } | { kind: 'notFound' }

export interface PublicNavigationQueries {
  listCompetitions(): Promise<PublicCompetitionNavigation[]>
  resolveCompetition(slug: string): Promise<PublicRouteResolution<PublicCompetitionPage>>
  resolveSeason(
    competitionSlug: string,
    seasonSlug: string,
  ): Promise<PublicRouteResolution<PublicSeasonPage>>
}
