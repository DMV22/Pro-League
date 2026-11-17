import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { revalidateTag } from 'next/cache'
import { invalidatePublicCache } from './invalidate-public-cache'

beforeEach(() => vi.clearAllMocks())

it('maps typed targets only through the versioned infrastructure tag registry', async () => {
  const id = '01990000-0000-7000-8000-000000009403'
  await invalidatePublicCache({ kind: 'portal' })
  await invalidatePublicCache({ kind: 'competition', id })
  await invalidatePublicCache({ kind: 'season', id })
  await invalidatePublicCache({ kind: 'schedule', id })
  await invalidatePublicCache({ kind: 'standings', id })
  expect(vi.mocked(revalidateTag).mock.calls).toEqual([
    ['public:v1:portal', { expire: 0 }],
    [`public:v1:competition:${id}`, { expire: 0 }],
    [`public:v1:season:${id}`, { expire: 0 }],
    [`public:v1:season-schedule:${id}`, { expire: 0 }],
    [`public:v1:season-standings:${id}`, { expire: 0 }],
  ])
})
