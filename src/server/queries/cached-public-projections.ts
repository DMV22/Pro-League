import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import type {
  PublicProjectionRequest,
  PublicProjectionState,
} from '../../application/queries/public-projections'
import { publicTags } from '../cache/public-tags'
import { getDatabase } from '../db/client'
import { createPublicProjectionSnapshotQuery } from './public-projection-snapshot'

export async function readCachedPublicProjection(
  request: PublicProjectionRequest,
  state: PublicProjectionState,
) {
  'use cache'
  cacheLife('publicSporting')
  if (request.kind === 'home') cacheTag(publicTags.portal())
  if (state.competitionId) cacheTag(publicTags.competition(state.competitionId))
  if (state.seasonId)
    cacheTag(
      publicTags.season(state.seasonId),
      publicTags.schedule(state.seasonId),
      publicTags.standings(state.seasonId),
    )
  return createPublicProjectionSnapshotQuery(getDatabase()).read(request, state)
}
