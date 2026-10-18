import 'server-only'
import { cache } from 'react'
import { createPublicProjectionReader } from '../../application/queries/public-projection-reader'
import type { PublicProjectionRequest } from '../../application/queries/public-projections'
import { getDatabase } from '../db/client'
import { createPublicProjectionStateQuery } from './public-projection-state'
import { readCachedPublicProjection } from './cached-public-projections'
import { assertPreviewRuntime, PreviewConfigurationError } from '../db/preview-target'

const reader = createPublicProjectionReader({
  probe: (request) => createPublicProjectionStateQuery(getDatabase()).read(request),
  load: readCachedPublicProjection,
})
const read = cache(
  (kind: PublicProjectionRequest['kind'], competitionSlug: string, seasonSlug: string) =>
    reader.read(
      kind === 'home'
        ? { kind }
        : kind === 'competition'
          ? { kind, competitionSlug }
          : { kind, competitionSlug, seasonSlug },
    ),
)

export function getRuntimePublicProjection(request: PublicProjectionRequest) {
  // Configuration failure must never activate the last-verified fallback.
  try {
    assertPreviewRuntime(process.env.DATABASE_URL)
  } catch (error) {
    if (!(error instanceof PreviewConfigurationError)) throw error
    return Promise.resolve({ kind: 'unavailable' as const })
  }
  return read(
    request.kind,
    request.kind === 'home' ? '' : request.competitionSlug,
    request.kind === 'season' ? request.seasonSlug : '',
  )
}
