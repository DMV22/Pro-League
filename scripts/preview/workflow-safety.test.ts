import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

it('exposes only normal manual operations with trusted checkout and mutation serialization', () => {
  const workflow = parse(
    readFileSync(new URL('../../.github/workflows/preview-lifecycle.yml', import.meta.url), 'utf8'),
  )
  expect(Object.keys(workflow.on.workflow_dispatch.inputs)).toEqual(['pr', 'operation'])
  expect(workflow.on.workflow_dispatch.inputs.operation.options).toEqual(['run', 'recreate'])
  expect(workflow.on.workflow_dispatch.inputs.operation.default).toBe('run')
  expect(workflow.concurrency['cancel-in-progress']).toBe(false)
  expect(workflow.jobs.reconcile.concurrency.group).toBe('isolated-preview-mutations')
  for (const job of Object.values(workflow.jobs) as {
    steps: { uses?: string; with?: Record<string, unknown> }[]
  }[]) {
    const checkout = job.steps.find((step) => step.uses?.startsWith('actions/checkout@'))
    expect(checkout?.with?.ref).toBe('${{ github.workflow_sha }}')
    expect(checkout?.with?.['persist-credentials']).toBe(false)
  }
  const inspect = workflow.jobs.inspect.steps.find((step: { id?: string }) => step.id === 'plan')
  expect(inspect.env).not.toHaveProperty('PREVIEW_OPERATION')
  expect(workflow.jobs['approve-migrations'].environment).toBe('preview-migrations')
})

it.each([
  { command: 'recreate-short-ttl', requests: false },
  { command: 'test-cleanup-failure', requests: false },
  { command: 'test-allocation-block', requests: false },
  { command: 'inspect', requests: true },
])(
  'validates CLI operation $command before provider access (requests=$requests)',
  ({ command, requests }) => {
    const forbidNetwork = `data:text/javascript,${encodeURIComponent('globalThis.fetch = async () => { process.stdout.write("UNEXPECTED_FETCH"); throw new Error("network forbidden") }')}`
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        forbidNetwork,
        '--import',
        new URL('./node_modules/tsx/dist/loader.mjs', import.meta.url).href,
        fileURLToPath(new URL('./cli.ts', import.meta.url)),
        command,
        '120',
      ],
      {
        cwd: fileURLToPath(new URL('../../', import.meta.url)),
        env: {
          NODE_ENV: 'test',
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          TEMP: process.env.TEMP,
          TMP: process.env.TMP,
          GITHUB_ACTIONS: 'true',
          GITHUB_EVENT_NAME: 'workflow_dispatch',
          GITHUB_REPOSITORY: 'DMV22/Pro-League',
          GITHUB_WORKFLOW_REF:
            'DMV22/Pro-League/.github/workflows/preview-lifecycle.yml@refs/heads/main',
          GITHUB_WORKFLOW_SHA: 'a'.repeat(40),
          PREVIEW_STATE_KEY: '12'.repeat(32),
          GH_TOKEN: 'test-only-not-a-credential',
        },
        encoding: 'utf8',
        timeout: 15_000,
        windowsHide: true,
      },
    )
    expect(result.error).toBeUndefined()
    expect(result.status, result.stderr).toBe(1)
    expect(result.stderr).toContain('Isolated Preview operation failed')
    // The inspect control proves the stub is installed and the trusted test context is valid.
    expect(result.stdout.includes('UNEXPECTED_FETCH')).toBe(requests)
  },
  20_000,
)
