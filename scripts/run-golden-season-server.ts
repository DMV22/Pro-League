import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

import { assertGoldenSeasonTarget } from './db/golden-season-target'
import { loadProjectEnv } from './db/load-env'

export function runGoldenSeasonServer(command: 'dev' | 'start'): void {
  loadProjectEnv()

  const seedUrl = process.env.SEED_DATABASE_URL?.trim()
  if (!seedUrl || seedUrl.includes('replace-with-a-private-local-password')) {
    throw new Error('Set a private SEED_DATABASE_URL for the local Golden Season database')
  }

  assertGoldenSeasonTarget(seedUrl, 'local', 'proleague_golden_seed')

  const requireFromProject = createRequire(resolve('package.json'))
  const nextCli = requireFromProject.resolve('next/dist/bin/next')

  const mode = command === 'dev' ? 'development' : 'production'
  console.info(`Starting Next.js in ${mode} mode with the disposable local Golden Season database`)
  const result = spawnSync(process.execPath, [nextCli, command, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: seedUrl },
    stdio: 'inherit',
  })

  if (result.error) throw result.error
  process.exitCode = result.status ?? (result.signal === 'SIGINT' ? 130 : 1)
}
