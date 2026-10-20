import { expect, it } from 'vitest'
import { createGitHub } from './github'
import { createJsonClient } from '../http'
import { createStateCodec } from '../state'

it('rejects a migration environment without a required reviewer', async () => {
  const github = createGitHub(
    createJsonClient('https://example.test', 'token', {
      fetch: async () =>
        Response.json({
          protection_rules: [],
          deployment_branch_policy: { custom_branch_policies: true },
        }),
    }),
    createStateCodec('12'.repeat(32)),
  )
  await expect(github.assertEnvironment('preview-migrations', true)).rejects.toThrow(
    'required reviewer',
  )
})

it('does not prepare cloud resources after failed baseline CI for the current SHA', async () => {
  const github = createGitHub(
    createJsonClient('https://example.test', 'token', {
      fetch: async () =>
        Response.json({
          workflow_runs: [
            {
              head_sha: 'a'.repeat(40),
              status: 'completed',
              conclusion: 'failure',
              head_repository: { full_name: 'DMV22/Pro-League' },
              pull_requests: [{ number: 120 }],
            },
          ],
        }),
    }),
    createStateCodec('12'.repeat(32)),
  )
  await expect(
    github.baseline({
      number: 120,
      repository: 'DMV22/Pro-League',
      headRepository: 'DMV22/Pro-League',
      base: 'develop',
      sha: 'a'.repeat(40),
      state: 'open',
    }),
  ).rejects.toThrow('Baseline CI failed')
})
