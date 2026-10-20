import { expect, it } from 'vitest'
import { createJsonClient } from '../http'
import { createRender } from './render'

it('reports an unrecorded child Preview without mutating it', async () => {
  const methods: string[] = []
  const render = createRender(
    createJsonClient('https://example.test', 'token', {
      fetch: async (_url, init) => {
        methods.push(init!.method!)
        return Response.json([
          {
            service: { id: 'srv-unknown', serviceDetails: { parentServer: { id: 'srv-base' } } },
            cursor: '',
          },
        ])
      },
    }),
    { baseServiceId: 'srv-base', ownerId: 'tea-workspace' },
  )
  expect(await render.unknownPreviews(new Set())).toEqual(['srv-unknown'])
  expect(methods).toEqual(['GET'])
})

it('rejects a matching display name belonging to a different base service', async () => {
  const client = createJsonClient('https://example.test', 'token', {
    fetch: async () =>
      Response.json({
        id: 'srv-preview',
        ownerId: 'tea-workspace',
        name: 'pro-league-development PR #120',
        repo: 'https://github.com/DMV22/Pro-League',
        branch: 'codex/test',
        serviceDetails: {
          url: 'https://pro-league-development-pr-120.onrender.com',
          parentServer: { id: 'srv-foreign' },
        },
      }),
  })
  const render = createRender(client, { baseServiceId: 'srv-base', ownerId: 'tea-workspace' })
  await expect(render.service('srv-preview', 120, 'codex/test')).rejects.toThrow(
    'Render identity differs',
  )
})

it('sets only the matching reader binding and deploys the exact reviewed SHA', async () => {
  const writes: { path: string; method: string; body: unknown }[] = []
  const identity = {
    projectId: 'long-sea-15202409',
    parentBranchId: 'br-divine-leaf-b90tlpj2',
    branchId: 'br-preview120',
    endpointId: 'ep-preview120',
    directHost: 'ep-preview120.c-7.eu-central-1.aws.neon.tech',
    pullRequest: 120,
    database: 'proleague_golden_seed_pr_120',
  }
  const render = createRender(
    createJsonClient('https://example.test', 'token', {
      fetch: async (url, init) => {
        const path = new URL(String(url)).pathname
        if (init?.method === 'GET' && path.includes('/env-vars/'))
          return new Response(null, { status: 404 })
        if (init?.method === 'GET')
          return Response.json({
            id: 'srv-preview',
            ownerId: 'tea-workspace',
            name: 'pro-league-development PR #120',
            repo: 'https://github.com/DMV22/Pro-League.git',
            branch: 'codex/test',
            serviceDetails: {
              url: 'https://pro-league-development-pr-120.onrender.com',
              parentServer: { id: 'srv-base' },
            },
          })
        writes.push({ path, method: init!.method!, body: JSON.parse(String(init!.body)) })
        return Response.json({ id: 'dep-exact' })
      },
    }),
    { baseServiceId: 'srv-base', ownerId: 'tea-workspace' },
  )
  const databaseUrl =
    'postgresql://preview_reader_pr_120:private-test-password@ep-preview120-pooler.c-7.eu-central-1.aws.neon.tech/proleague_golden_seed_pr_120?sslmode=verify-full'
  expect(
    await render.bindAndDeploy('srv-preview', 'codex/test', identity, databaseUrl, 'a'.repeat(40)),
  ).toEqual({ serviceId: 'srv-preview', deployId: 'dep-exact' })
  expect(writes).toEqual([
    { path: '/services/srv-preview', method: 'PATCH', body: { autoDeployTrigger: 'off' } },
    {
      path: '/services/srv-preview/env-vars/DATABASE_URL',
      method: 'PUT',
      body: { value: databaseUrl },
    },
    {
      path: '/services/srv-preview/env-vars/PREVIEW_DATABASE_IDENTITY',
      method: 'PUT',
      body: { value: JSON.stringify(identity) },
    },
    {
      path: '/services/srv-preview/deploys',
      method: 'POST',
      body: { commitId: 'a'.repeat(40), clearCache: 'do_not_clear' },
    },
  ])
})
