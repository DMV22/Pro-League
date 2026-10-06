import { describe, expect, it } from 'vitest'

import { assertGoldenSeasonTarget } from './golden-season-target'

const url = (database: string, host = '127.0.0.1') =>
  `postgresql://seed:private@${host}:5432/${database}`

describe('Golden Season seed target gate', () => {
  it('accepts only an exactly confirmed dedicated local database', () => {
    expect(
      assertGoldenSeasonTarget(url('proleague_golden_seed'), 'local', 'proleague_golden_seed'),
    ).toBe('proleague_golden_seed')
  })

  it('refuses the normal development and production databases', () => {
    expect(() => assertGoldenSeasonTarget(url('proleague'), 'local', 'proleague')).toThrow()
    expect(() =>
      assertGoldenSeasonTarget(
        url('proleague_production', 'production.example'),
        'preview',
        'proleague_production',
        12,
      ),
    ).toThrow()
    expect(() =>
      assertGoldenSeasonTarget(url('proleague_golden_seed'), 'local', undefined),
    ).toThrow()
  })

  it('requires the exact PR-scoped Preview database', () => {
    expect(
      assertGoldenSeasonTarget(
        url('proleague_golden_seed_pr_75', 'preview.example'),
        'preview',
        'proleague_golden_seed_pr_75',
        75,
      ),
    ).toBe('proleague_golden_seed_pr_75')
    expect(() =>
      assertGoldenSeasonTarget(
        url('proleague_golden_seed_pr_74', 'preview.example'),
        'preview',
        'proleague_golden_seed_pr_74',
        75,
      ),
    ).toThrow()
  })

  it('does not permit remote local/CI targets or session option overrides', () => {
    expect(() =>
      assertGoldenSeasonTarget(
        url('proleague_golden_seed', 'remote.example'),
        'local',
        'proleague_golden_seed',
      ),
    ).toThrow()
    expect(() =>
      assertGoldenSeasonTarget(
        `${url('proleague_golden_seed')}?options=-csearch_path%3Dpublic`,
        'local',
        'proleague_golden_seed',
      ),
    ).toThrow()
  })
})
