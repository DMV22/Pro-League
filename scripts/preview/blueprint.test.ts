import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { validateBlueprint } from './blueprint'

it('accepts the repository Blueprint without API credentials or a Render workspace', () => {
  const source = readFileSync(new URL('../../render.yaml', import.meta.url), 'utf8')
  expect(() => validateBlueprint(source)).not.toThrow()
})

it.each([
  [
    'unknown service field',
    (source: string) =>
      source.replace('    runtime: node', '    runtime: node\n    misspelledField: true'),
  ],
  ['unknown runtime', (source: string) => source.replace('runtime: node', 'runtime: imaginary')],
  [
    'missing service name',
    (source: string) => source.replace('    name: pro-league-development\n', ''),
  ],
  [
    'invalid Preview mode',
    (source: string) => source.replace('generation: manual', 'generation: disabled'),
  ],
])('rejects a Blueprint with %s', (_name, change) => {
  const source = readFileSync(new URL('../../render.yaml', import.meta.url), 'utf8').replaceAll(
    '\r\n',
    '\n',
  )
  expect(() => validateBlueprint(change(source))).toThrow('Blueprint schema validation failed')
})

it.each([
  'services: []\nservices: []',
  'services: []\n---\nservices: []',
  'services: !!js/function function() {}',
  'services: &cycle\n  - *cycle',
])('rejects ambiguous or unsafe YAML: %s', (source) => {
  expect(() => validateBlueprint(source)).toThrow('Blueprint YAML is invalid')
})

it('does not print a bad env var value in validation diagnostics', () => {
  const source =
    'services: [{type: web, name: example, runtime: node, envVars: [{key: EXAMPLE, value: {secret: private-provider-token}}]}]'
  try {
    validateBlueprint(source)
    expect.fail('An object env var value must fail schema validation')
  } catch (error) {
    expect(String(error)).toContain('Blueprint schema validation failed')
    expect(String(error)).not.toContain('private-provider-token')
  }
})

it('rejects oversized input before parsing it', () => {
  expect(() => validateBlueprint('x'.repeat(1024 * 1024 + 1))).toThrow('exceeds 1 MiB')
})
