import { expect, it } from 'vitest'
import { cacheInvalidationIntent, readCacheInvalidation } from './cache-invalidation'

it('describes a public schedule revision without accepting framework tags', () => {
  const intent = cacheInvalidationIntent({
    id: '01990000-0133-7000-8000-000000000001',
    target: { kind: 'schedule', id: '01990000-0133-7000-8000-000000000002' },
    revision: 18n,
    correlationKey: 'cache-test',
    causationKey: 'accepted-command',
  })
  expect(intent).toMatchObject({
    messageType: 'public.cache.invalidate',
    schemaVersion: 1,
    aggregateVersion: 18n,
    payload: {
      target: 'schedule:01990000-0133-7000-8000-000000000002',
      revision: '18',
      urgency: 'ordinary',
    },
  })
})

it('rejects an urgent purge, a forged target, mismatched versions and unregistered payload fields', () => {
  const valid = cacheInvalidationIntent({
    id: '01990000-0133-7000-8000-000000000001',
    target: { kind: 'portal' },
    revision: 3n,
    correlationKey: 'test',
    causationKey: 'test',
  })
  for (const payload of [
    { ...valid.payload, urgency: 'urgent' },
    { ...valid.payload, target: 'admin:private' },
    { ...valid.payload, revision: '4' },
    { ...valid.payload, unregistered: 'data' },
  ])
    expect(() => readCacheInvalidation({ ...valid, payload })).toThrow()
})
