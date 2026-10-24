import { describe, expect, it } from 'vitest'
import { assertM3AcceptanceTarget } from './m3-acceptance-fixture'

describe('M3 acceptance target', () => {
  it.each(['local', 'ci'])('allows only an explicitly confirmed %s fixture', (target) => {
    const database = `proleague_m3_acceptance_${target}`
    expect(
      assertM3AcceptanceTarget(`postgresql://test:fake@127.0.0.1:5434/${database}`, database),
    ).toBe(database)
  })
  it.each([
    undefined,
    'not-a-url',
    'postgresql://test:fake@remote.invalid/proleague_m3_acceptance_local',
    'postgresql://test:fake@127.0.0.1/proleague_golden_seed',
    'postgresql://test:fake@127.0.0.1/proleague',
    'postgresql://test:fake@127.0.0.1/proleague_m3_acceptance_local?host=remote.invalid',
    'postgresql://test:fake@127.0.0.1/proleague_m3_acceptance_local#fragment',
  ])('refuses unsafe targets before any database access', (url) => {
    expect(() => assertM3AcceptanceTarget(url, 'proleague_m3_acceptance_local')).toThrow()
  })
  it('requires matching confirmation', () => {
    expect(() =>
      assertM3AcceptanceTarget(
        'postgresql://test:fake@127.0.0.1/proleague_m3_acceptance_local',
        undefined,
      ),
    ).toThrow()
  })
})
