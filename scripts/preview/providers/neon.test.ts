import { expect, it } from 'vitest'
import { createNeon } from './neon'
import { createJsonClient } from '../http'
import { createStateCodec } from '../state'

it('reports unknown branches for operator review instead of adopting or deleting them', async () => {
  const requests: string[] = []
  const neon = createNeon(
    createJsonClient('https://example.test', 'token', {
      fetch: async (url, init) => {
        requests.push(`${init?.method} ${url}`)
        return Response.json({
          branches: [
            { id: 'br-divine-leaf-b90tlpj2', name: 'preview-empty' },
            { id: 'br-unknown', name: 'pr-120', parent_id: 'br-divine-leaf-b90tlpj2' },
          ],
        })
      },
    }),
    createStateCodec('12'.repeat(32)),
  )
  expect(await neon.unknownBranches(new Set())).toEqual(['br-unknown'])
  expect(requests.every((request) => request.startsWith('GET '))).toBe(true)
})

it('refuses a foreign parent before requesting credentials or creating a branch', async () => {
  const client = createJsonClient('https://example.test', 'token', {
    fetch: async () =>
      Response.json({
        project: {
          id: 'long-sea-15202409',
          name: 'proleague-preview',
          region_id: 'aws-eu-central-1',
          pg_version: 18,
        },
        branch: { id: 'br-divine-leaf-b90tlpj2', name: 'production', parent_id: 'br-production' },
      }),
  })
  const neon = createNeon(client, createStateCodec('12'.repeat(32)))
  await expect(neon.parent()).rejects.toThrow('Empty parent identity differs')
})
