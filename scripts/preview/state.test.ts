import { expect, it } from 'vitest'
import { createStateCodec } from './state'

it('rejects a modified public ownership record instead of adopting another database', () => {
  const codec = createStateCodec('12'.repeat(32))
  const record = {
    pr: 120,
    sha: 'a'.repeat(40),
    expiresAt: '2026-10-27T00:00:00.000Z',
    phase: 'reserved' as const,
  }
  const encoded = codec.encode(record)
  expect(codec.decode(encoded, 120)).toEqual(record)
  expect(() => codec.decode(encoded.replace('120', '121'), 121)).toThrow()
})
