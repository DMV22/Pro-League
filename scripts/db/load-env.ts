import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const requireFromProject = createRequire(resolve('package.json'))
const { loadEnvConfig } = requireFromProject('@next/env') as typeof import('@next/env')

export function loadProjectEnv(): void {
  loadEnvConfig(process.cwd())
}
