import { readFileSync } from 'node:fs'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { parseDocument } from 'yaml'

const schema = JSON.parse(
  readFileSync(new URL('./schemas/render.yaml.schema.json', import.meta.url), 'utf8'),
)
// Render's schema uses required/properties inside allOf without repeating the parent type.
// These two lint options do not disable required-field or type validation.
const ajv = new Ajv2020({ strict: true, strictTypes: false, strictRequired: false })
addFormats(ajv)
const validate = ajv.compile(schema)

/** Structural validation only: no API calls, env loading, provisioning or YAML execution. */
export function validateBlueprint(source: string): void {
  if (Buffer.byteLength(source) > 1024 * 1024) throw new Error('Blueprint exceeds 1 MiB')
  let data: unknown
  try {
    const document = parseDocument(source, {
      uniqueKeys: true,
      stringKeys: true,
      prettyErrors: false,
      version: '1.2',
      merge: true,
    })
    if (document.errors.length || document.warnings.length) throw new Error('Invalid YAML')
    data = document.toJS({ maxAliasCount: 100 })
    // Reject cyclic aliases before recursive JSON Schema validation.
    JSON.stringify(data)
  } catch {
    // YAML exceptions can contain source lines, including env var values.
    throw new Error('Blueprint YAML is invalid, ambiguous or exceeds alias limits')
  }
  if (!validate(data)) {
    const error = validate.errors?.[0]
    throw new Error(
      `Blueprint schema validation failed ${JSON.stringify({
        path: error?.instancePath ?? '/',
        rule: error?.keyword,
      })}`,
    )
  }
}
