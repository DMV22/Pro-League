import { expect, it } from 'vitest'
import { createPublicProjectionReader } from './public-projection-reader'
import {
  PublicProjectionUnavailable,
  PublicProjectionChanged,
  type PublicProjectionSnapshot,
} from './public-projections'

const snapshot: PublicProjectionSnapshot = {
  state: {
    key: 'portal',
    revision: '1',
    lastUpdatedAt: '2026-03-01T09:00:00Z',
    seasonDate: null,
    seasonTimezone: null,
    competitionId: null,
    seasonId: null,
  },
  payload: { kind: 'home', competitions: [] },
}

it('discards an old projection as soon as a changed source or hidden route is confirmed', async () => {
  let mode: 'old' | 'new' | 'hidden' | 'offline' = 'old'
  const reader = createPublicProjectionReader({
    probe: async () => {
      if (mode === 'offline') throw new PublicProjectionUnavailable()
      if (mode === 'hidden') return { kind: 'notFound' }
      return { kind: 'found', state: { ...snapshot.state, revision: mode === 'new' ? '2' : '1' } }
    },
    load: async () => {
      if (mode === 'new') throw new PublicProjectionUnavailable()
      return snapshot
    },
  })
  await reader.read({ kind: 'home' })
  mode = 'new'
  expect(await reader.read({ kind: 'home' })).toEqual({ kind: 'unavailable' })
  mode = 'old'
  await reader.read({ kind: 'home' })
  mode = 'hidden'
  expect(await reader.read({ kind: 'home' })).toEqual({ kind: 'notFound' })
  mode = 'offline'
  expect(await reader.read({ kind: 'home' })).toEqual({ kind: 'unavailable' })
})

it('warns on a warm-cache outage but never renews the fallback deadline', async () => {
  let now = 0
  let offline = false
  const reader = createPublicProjectionReader({
    now: () => now,
    probe: async () => {
      if (offline) throw new PublicProjectionUnavailable()
      return { kind: 'found', state: snapshot.state }
    },
    load: async () => snapshot,
  })
  expect(await reader.read({ kind: 'home' })).toMatchObject({
    kind: 'ready',
    freshness: 'fresh',
    lastUpdatedAt: '2026-03-01T09:00:00Z',
  })
  offline = true
  now = 120_000
  expect(await reader.read({ kind: 'home' })).toMatchObject({ kind: 'ready', freshness: 'stale' })
  now = 300_000
  expect(await reader.read({ kind: 'home' })).toEqual({ kind: 'unavailable' })
})

it('retries a snapshot race and rejects an inconsistent snapshot rather than labelling it fresh', async () => {
  let changed = false
  const reader = createPublicProjectionReader({
    probe: async () => ({
      kind: 'found',
      state: { ...snapshot.state, revision: changed ? '2' : '1' },
    }),
    load: async (_, state) => {
      if (!changed) {
        changed = true
        throw new PublicProjectionChanged()
      }
      return { ...snapshot, state }
    },
  })
  expect(await reader.read({ kind: 'home' })).toMatchObject({ kind: 'ready', freshness: 'fresh' })
  const broken = createPublicProjectionReader({
    probe: async () => ({ kind: 'found', state: snapshot.state }),
    load: async () => ({ ...snapshot, state: { ...snapshot.state, revision: '9' } }),
  })
  expect(await broken.read({ kind: 'home' })).toEqual({ kind: 'unavailable' })
})

it('keeps fallback bounded and never hides a programming failure behind a warm cache', async () => {
  let fail = false
  const reader = createPublicProjectionReader({
    maxEntries: 1,
    probe: async (request) => {
      if (fail) throw new PublicProjectionUnavailable()
      return { kind: 'found', state: { ...snapshot.state, key: JSON.stringify(request) } }
    },
    load: async (_, state) => ({ ...snapshot, state }),
  })
  await reader.read({ kind: 'home' })
  await reader.read({ kind: 'competition', competitionSlug: 'cup' })
  fail = true
  expect(await reader.read({ kind: 'home' })).toEqual({ kind: 'unavailable' })
  const buggy = createPublicProjectionReader({
    probe: async () => {
      throw new TypeError('Invalid query mapping')
    },
    load: async () => snapshot,
  })
  await expect(buggy.read({ kind: 'home' })).rejects.toThrow('Invalid query mapping')
})

it('does not restore a revoked fallback when an older in-flight read finishes late', async () => {
  let mode: 'public' | 'hidden' | 'offline' = 'public'
  let finish!: (value: PublicProjectionSnapshot) => void
  const reader = createPublicProjectionReader({
    probe: async () => {
      if (mode === 'offline') throw new PublicProjectionUnavailable()
      return mode === 'hidden' ? { kind: 'notFound' } : { kind: 'found', state: snapshot.state }
    },
    load: async () =>
      new Promise<PublicProjectionSnapshot>((resolve) => {
        finish = resolve
      }),
  })
  const early = reader.read({ kind: 'home' })
  await Promise.resolve()
  mode = 'hidden'
  expect(await reader.read({ kind: 'home' })).toEqual({ kind: 'notFound' })
  finish(snapshot)
  await early
  mode = 'offline'
  expect(await reader.read({ kind: 'home' })).toEqual({ kind: 'unavailable' })
})

it('does not reuse a previous civil-date calculation after midnight during an outage', async () => {
  let now = Date.parse('2026-04-05T20:59:00Z')
  let offline = false
  const timed = {
    ...snapshot,
    state: { ...snapshot.state, seasonDate: '2026-04-05', seasonTimezone: 'Europe/Kyiv' },
  }
  const reader = createPublicProjectionReader({
    now: () => now,
    probe: async () => {
      if (offline) throw new PublicProjectionUnavailable()
      return { kind: 'found', state: timed.state }
    },
    load: async () => timed,
  })
  await reader.read({ kind: 'home' })
  offline = true
  now = Date.parse('2026-04-05T21:01:00Z')
  expect(await reader.read({ kind: 'home' })).toEqual({ kind: 'unavailable' })
})
