import { readFileSync, statSync } from 'node:fs'
import { validateBlueprint } from './blueprint'

try {
  const file = new URL('../../render.yaml', import.meta.url)
  if (process.argv.length !== 2) throw new Error('Blueprint validation takes no arguments')
  if (statSync(file).size > 1024 * 1024) throw new Error('Blueprint exceeds 1 MiB')
  validateBlueprint(readFileSync(file, 'utf8'))
  console.info('Render Blueprint matches the pinned official JSON Schema; no API credentials used')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Blueprint validation failed')
  process.exitCode = 1
}
