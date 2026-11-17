import 'server-only'
import { sql, type SQL } from 'drizzle-orm'
import type { Database } from '../db/transaction-types'
import {
  PublicProjectionUnavailable,
  type PublicProjectionProbe,
  type PublicProjectionRequest,
} from '../../application/queries/public-projections'

/** Do not turn schema errors, invalid DTOs or programming bugs into stale success. */
export function projectionReadFailure(error: unknown): never {
  let cause = error
  while (cause && typeof cause === 'object') {
    const code = 'code' in cause ? String(cause.code) : ''
    const message = 'message' in cause ? String(cause.message) : ''
    if (
      code.startsWith('08') ||
      [
        '57P01',
        '57P02',
        '57P03',
        '53300',
        '57014',
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'EHOSTUNREACH',
      ].includes(code) ||
      /^(Connection terminated unexpectedly|Connection terminated|timeout exceeded when trying to connect|Connection terminated due to connection timeout|Query read timeout)/.test(
        message,
      )
    )
      throw new PublicProjectionUnavailable('Authoritative public data is unavailable')
    cause = 'cause' in cause ? cause.cause : null
  }
  throw error
}

type Row = {
  projection_key: string
  revision: string
  cache_generation: string
  last_updated_at: string | Date | null
  competition_id: string | null
  season_id: string | null
  competition_slug: string | null
  season_slug: string | null
  season_date: string | null
  season_timezone?: string
  synchronization?: 'pending' | 'attention' | null
}
const normalize = (slug: string) => slug.normalize('NFKC').trim().toLowerCase()

// Confirmed watermarks are durable cache identity. Pending operational evidence is not.
// Targets mirror every tag attached to the snapshot, with independent source clocks.
function withSynchronization(projection: SQL) {
  return sql`with projection as (${projection})
    select projection.*, generation.value as cache_generation,
      synchronization.status as synchronization
    from projection
    cross join lateral (
      select array_agg(t.target order by t.target) as targets,
        jsonb_agg(jsonb_build_array(t.target, coalesce(w.revision,0)::text)
          order by t.target)::text as value
      from (
        select projection.projection_key as target
        union
        select 'competition:' || projection.competition_id
          where projection.competition_id is not null
        union
        select kind || ':' || projection.season_id
          from unnest(array['season','schedule','standings']) kind
          where projection.season_id is not null
      ) t
      left join lateral (
        select max(committed_version) as revision from app.cache_invalidation_intents
        where semantic_target=t.target and state='confirmed' and urgency='ordinary'
      ) w on true
    ) generation
    left join lateral (
      select case when bool_or(
        c.state='failed' or o.state in ('failed','exhausted') or
        c.created_at <= clock_timestamp() - interval '60 seconds'
      ) then 'attention' else 'pending' end as status
      from app.cache_invalidation_intents c
      left join app.outbox_messages o on o.id=c.id
      join app.public_projection_revisions source on source.projection_key=
        case when c.semantic_target like 'schedule:%' or c.semantic_target like 'standings:%'
          then 'season:' || split_part(c.semantic_target,':',2)
          else c.semantic_target end
      where c.state <> 'confirmed' and c.urgency='ordinary'
        and c.committed_version <= source.revision
        and c.semantic_target = any(generation.targets)
      having count(*) > 0
    ) synchronization on true`
}

export function createPublicProjectionStateQuery(database: Pick<Database, 'execute'>) {
  return {
    async read(request: PublicProjectionRequest, now = new Date()): Promise<PublicProjectionProbe> {
      try {
        let rows: Row[]
        if (request.kind === 'home') {
          rows = (
            await database.execute<Row>(
              withSynchronization(
                sql`select projection_key, revision::text, last_updated_at, null::uuid as competition_id, null::uuid as season_id, null::text as competition_slug, null::text as season_slug, null::text as season_date from app.public_projection_revisions where projection_key='portal'`,
              ),
            )
          ).rows
        } else if (request.kind === 'competition') {
          rows = (
            await database.execute<Row>(
              withSynchronization(sql`select p.projection_key, p.revision::text, p.last_updated_at, c.id as competition_id, null::uuid as season_id, current.display_slug as competition_slug, null::text as season_slug, null::text as season_date
            from app.competition_slugs history join app.competitions c on c.id=history.competition_id
            join app.competition_slugs current on current.id=c.current_slug_id and current.competition_id=c.id
            join app.public_projection_revisions p on p.projection_key='competition:' || c.id
            where history.normalized_slug=${normalize(request.competitionSlug)} and c.visibility='public'`),
            )
          ).rows
        } else {
          rows = (
            await database.execute<Row>(
              withSynchronization(sql`select p.projection_key, p.revision::text, p.last_updated_at, c.id as competition_id, s.id as season_id, cc.display_slug as competition_slug, cs.display_slug as season_slug,
            s.timezone as season_timezone, to_char(${now.toISOString()}::timestamptz at time zone s.timezone,'YYYY-MM-DD') as season_date
            from app.competition_slugs ch join app.competitions c on c.id=ch.competition_id
            join app.competition_slugs cc on cc.id=c.current_slug_id and cc.competition_id=c.id
            join app.season_slugs sh on sh.competition_id=c.id and sh.normalized_slug=${normalize(request.seasonSlug)}
            join app.seasons s on s.id=sh.season_id and s.competition_id=c.id
            join app.season_slugs cs on cs.id=s.current_slug_id and cs.season_id=s.id and cs.competition_id=c.id
            join app.public_projection_revisions p on p.projection_key='season:' || s.id
            where ch.normalized_slug=${normalize(request.competitionSlug)} and c.visibility='public' and s.visibility='public'`),
            )
          ).rows
        }
        const row = rows[0]
        if (!row) return { kind: 'notFound' }
        if (
          request.kind !== 'home' &&
          (request.competitionSlug !== row.competition_slug ||
            (request.kind === 'season' && request.seasonSlug !== row.season_slug))
        ) {
          const pathname = `/competitions/${encodeURIComponent(row.competition_slug!)}${request.kind === 'season' ? `/seasons/${encodeURIComponent(row.season_slug!)}` : ''}`
          return { kind: 'redirect', pathname }
        }
        return {
          kind: 'found',
          ...(row.synchronization ? { synchronization: row.synchronization } : {}),
          state: {
            key: row.projection_key,
            revision: row.revision,
            cacheGeneration: row.cache_generation,
            lastUpdatedAt: row.last_updated_at ? new Date(row.last_updated_at).toISOString() : null,
            seasonDate: row.season_date,
            seasonTimezone: row.season_timezone ?? null,
            competitionId: row.competition_id,
            seasonId: row.season_id,
          },
        }
      } catch (error) {
        return projectionReadFailure(error)
      }
    },
  }
}
