import { describe, expect, it } from 'vitest'

import { assertIntegrationTarget } from './integration-target'

describe('integration database guard', () => {
  const url = 'postgresql://tester:secret@127.0.0.1:5434/proleague_integration'

  it('accepts only a confirmed dedicated loopback database', () => {
    expect(assertIntegrationTarget(url, 'local', 'proleague_integration')).toBe(url)
    expect(
      assertIntegrationTarget(
        url.replace('proleague_integration', 'proleague_integration_ci'),
        'ci',
        'proleague_integration_ci',
      ),
    ).toContain('proleague_integration_ci')
  })

  it.each([
    [undefined, 'local', 'proleague_integration'],
    [url, 'local', undefined],
    [url.replace('127.0.0.1', 'db.example.com'), 'local', 'proleague_integration'],
    [url.replace('proleague_integration', 'proleague'), 'local', 'proleague'],
    [`${url}?options=-csearch_path%3Dpublic`, 'local', 'proleague_integration'],
    [`${url}?host=other.example`, 'local', 'proleague_integration'],
    [url, 'ci', 'proleague_integration'],
  ] as const)('rejects unsafe target %#', (candidate, target, confirmation) => {
    expect(() => assertIntegrationTarget(candidate, target, confirmation)).toThrow()
  })
})
