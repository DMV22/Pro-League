import {
  PublicProjectionUnavailable,
  PublicProjectionChanged,
  type PublicProjectionProbe,
  type PublicProjectionRequest,
  type PublicProjectionSnapshot,
  type PublicProjectionState,
  type PublicProjectionView,
} from './public-projections'

export const PUBLIC_FALLBACK_TTL_MS = 300_000

type Dependencies = {
  probe(request: PublicProjectionRequest): Promise<PublicProjectionProbe>
  load(
    request: PublicProjectionRequest,
    state: PublicProjectionState,
  ): Promise<PublicProjectionSnapshot>
  now?: () => number
  maxEntries?: number
}

/** Owns last-verified responses, never an authoritative source or a private cache. */
export function createPublicProjectionReader(dependencies: Dependencies) {
  const now = dependencies.now ?? Date.now
  const maxEntries = dependencies.maxEntries ?? 128
  const inFlight = new Map<string, number>()
  let sequence = 0
  const verified = new Map<
    string,
    { snapshot: PublicProjectionSnapshot; expiresAt: number; bytes: number }
  >()
  const drop = (key: string) => verified.delete(key)
  const remember = (key: string, snapshot: PublicProjectionSnapshot) => {
    drop(key)
    const bytes = new TextEncoder().encode(key + JSON.stringify(snapshot)).byteLength
    if (bytes > 1_048_576) return
    for (const [candidate, entry] of verified) if (entry.expiresAt <= now()) drop(candidate)
    let total = [...verified.values()].reduce((sum, entry) => sum + entry.bytes, 0)
    while (verified.size >= maxEntries || total + bytes > 8_388_608) {
      const oldest = verified.keys().next().value
      if (oldest === undefined) break
      total -= verified.get(oldest)!.bytes
      drop(oldest)
    }
    verified.set(key, {
      snapshot: structuredClone(snapshot),
      expiresAt: now() + PUBLIC_FALLBACK_TTL_MS,
      bytes,
    })
  }
  return {
    async read(request: PublicProjectionRequest): Promise<PublicProjectionView> {
      const key = JSON.stringify(request)
      const generation = ++sequence
      inFlight.set(key, generation)
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const probe = await dependencies.probe(request)
            if (probe.kind !== 'found') {
              verified.delete(key)
              return probe
            }
            const previous = verified.get(key)
            if (
              previous &&
              (previous.snapshot.state.key !== probe.state.key ||
                previous.snapshot.state.revision !== probe.state.revision ||
                previous.snapshot.state.seasonDate !== probe.state.seasonDate)
            )
              verified.delete(key)
            const snapshot = await dependencies.load(request, probe.state)
            if (
              snapshot.state.key !== probe.state.key ||
              snapshot.state.revision !== probe.state.revision ||
              snapshot.state.seasonDate !== probe.state.seasonDate
            )
              throw new PublicProjectionChanged()
            if (inFlight.get(key) === generation) remember(key, snapshot)
            return {
              kind: 'ready',
              freshness: 'fresh',
              lastUpdatedAt: snapshot.state.lastUpdatedAt,
              payload: snapshot.payload,
            }
          } catch (error) {
            if (error instanceof PublicProjectionChanged) {
              verified.delete(key)
              continue
            }
            if (!(error instanceof PublicProjectionUnavailable)) throw error
            const entry = verified.get(key)
            let sameDate = true
            if (entry?.snapshot.state.seasonTimezone && entry.snapshot.state.seasonDate) {
              const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: entry.snapshot.state.seasonTimezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              }).formatToParts(new Date(now()))
              const part = (type: Intl.DateTimeFormatPartTypes) =>
                parts.find((item) => item.type === type)!.value
              sameDate =
                `${part('year')}-${part('month')}-${part('day')}` ===
                entry.snapshot.state.seasonDate
            }
            if (entry && entry.expiresAt > now() && sameDate)
              return {
                kind: 'ready',
                freshness: 'stale',
                lastUpdatedAt: entry.snapshot.state.lastUpdatedAt,
                payload: entry.snapshot.payload,
              }
            verified.delete(key)
            return { kind: 'unavailable' }
          }
        }
        return { kind: 'unavailable' }
      } finally {
        if (inFlight.get(key) === generation) inFlight.delete(key)
      }
    },
  }
}
