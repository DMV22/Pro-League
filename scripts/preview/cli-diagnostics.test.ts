import { expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const sensitive = 'TEST-ONLY-DO-NOT-LOG-postgresql://user:password@private.example/db?token=secret'

function runInspect(failure: 'http' | 'invalid-json' | 'transport' | 'none' | 'once' = 'http') {
  const stub = `
    const sensitive = ${JSON.stringify(sensitive)};
    let fileReads = 0;
    globalThis.fetch = async (url, options) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/environments/preview-control'))
        return Response.json({deployment_branch_policy:{custom_branch_policies:true},protection_rules:[]});
      if (path.endsWith('/deployment-branch-policies'))
        return Response.json({total_count:1,branch_policies:[{name:'main',type:'branch'}]});
      if (path.endsWith('/pulls/120'))
        return Response.json({number:120,state:'open',changed_files:1,
          head:{sha:'${'a'.repeat(40)}',ref:'pilot',repo:{full_name:'DMV22/Pro-League'}},
          base:{ref:'develop',repo:{full_name:'DMV22/Pro-League'}}});
      if (path.endsWith('/pulls/120/files')) {
        fileReads++;
        process.stdout.write('FILES_READ\\n');
        if (${JSON.stringify(failure)} === 'once' && fileReads === 1) return new Response(sensitive,{status:500});
        if (${JSON.stringify(failure)} === 'http') return new Response(sensitive,{status:500});
        if (${JSON.stringify(failure)} === 'invalid-json') return new Response(sensitive,{status:200});
        if (${JSON.stringify(failure)} === 'transport') throw new Error(sensitive);
        return Response.json([{filename:'docs/acceptance.md'}]);
      }
      if (path.includes('/statuses/') && options.method === 'POST') {
        // A secondary publishing failure must not replace the original diagnostic.
        if (!['none','once'].includes(${JSON.stringify(failure)})) return new Response(sensitive,{status:403});
        return Response.json({}, {status:201});
      }
      throw new Error(sensitive);
    };
  `
  return spawnSync(
    process.execPath,
    [
      '--import',
      `data:text/javascript,${encodeURIComponent(stub)}`,
      '--import',
      new URL('./node_modules/tsx/dist/loader.mjs', import.meta.url).href,
      fileURLToPath(new URL('./cli.ts', import.meta.url)),
      'inspect',
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
        GH_TOKEN: sensitive,
      },
      encoding: 'utf8',
      timeout: 15_000,
      windowsHide: true,
    },
  )
}

it('reports inspect-files and HTTP 500 without exposing provider details or secrets', () => {
  const result = runInspect()
  expect(result.error).toBeUndefined()
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('stage=inspect-files; http=500')
  expect(result.stdout.match(/FILES_READ/g)).toHaveLength(3)
  expect(result.stderr).not.toContain(sensitive)
  expect(result.stdout).not.toContain(sensitive)
  expect(result.stderr).not.toContain('12'.repeat(32))
  expect(result.stderr).not.toMatch(/postgresql:|private\.example|Bearer|\bat .*cli\.ts/)
}, 20_000)

it.each([
  { failure: 'invalid-json' as const, code: 'unknown', reads: 1 },
  { failure: 'transport' as const, code: '0', reads: 3 },
])(
  'redacts $failure failures at the CLI boundary',
  ({ failure, code, reads }) => {
    const result = runInspect(failure)
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`stage=inspect-files; http=${code}`)
    expect(result.stdout.match(/FILES_READ/g)).toHaveLength(reads)
    expect(result.stderr + result.stdout).not.toContain(sensitive)
    expect(result.stderr).not.toMatch(/postgresql:|private\.example|Bearer|\bat .*cli\.ts/)
  },
  20_000,
)

it.each([
  { failure: 'none' as const, reads: 1 },
  { failure: 'once' as const, reads: 2 },
])(
  'successfully excludes a docs-only PR after $failure upstream failure',
  ({ failure, reads }) => {
    const result = runInspect(failure)
    expect(result.error).toBeUndefined()
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout.match(/FILES_READ/g)).toHaveLength(reads)
    expect(result.stderr).not.toContain('::error::')
    expect(result.stderr + result.stdout).not.toContain(sensitive)
  },
  20_000,
)
