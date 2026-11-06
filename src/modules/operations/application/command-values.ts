import { createHash } from 'node:crypto'
import { CommandExecutionFailure, type SafeCommandResult } from './command-execution-port'

/** Versioned tagged encoding: distinguishes arrays, objects, bigint, null and scalar types. */
export function commandPayloadHash(value: unknown): string {
  let nodes = 0
  function encode(item: unknown, depth: number): unknown {
    if (++nodes > 2048 || depth > 8) throw new CommandExecutionFailure('unavailable')
    if (item === null) return ['null']
    if (typeof item === 'boolean' || typeof item === 'string') return [typeof item, item]
    if (typeof item === 'number' && Number.isFinite(item))
      return ['number', Object.is(item, -0) ? 0 : item]
    if (typeof item === 'bigint') return ['bigint', item.toString()]
    if (Array.isArray(item)) return ['array', Array.from(item, (value) => encode(value, depth + 1))]
    if (
      item &&
      typeof item === 'object' &&
      [Object.prototype, null].includes(Object.getPrototypeOf(item))
    ) {
      const keys = Reflect.ownKeys(item)
      if (
        keys.some(
          (key) =>
            typeof key !== 'string' ||
            !Object.hasOwn(Object.getOwnPropertyDescriptor(item, key)!, 'value'),
        )
      )
        throw new CommandExecutionFailure('unavailable')
      return [
        'object',
        (keys as string[])
          .sort()
          .map((key) => [key, encode((item as Record<string, unknown>)[key], depth + 1)]),
      ]
    }
    throw new CommandExecutionFailure('unavailable')
  }
  const encoded = JSON.stringify(['command-intent-v1', encode(value, 0)])
  if (Buffer.byteLength(encoded) > 32_768) throw new CommandExecutionFailure('unavailable')
  return createHash('sha256').update(encoded).digest('hex')
}

/** Projection allowlist, not arbitrary-string DLP; owning commands must select safe output fields. */
export function snapshotCommandResult(
  value: unknown,
  fields: readonly string[],
): SafeCommandResult {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    fields.length > 16
  )
    throw new CommandExecutionFailure('unavailable')
  for (const key of Reflect.ownKeys(value)) {
    if (
      typeof key !== 'string' ||
      !fields.includes(key) ||
      !/^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(key) ||
      /password|secret|token|cookie|email|credential|private|rawPayload/i.test(key) ||
      !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, 'value')
    )
      throw new CommandExecutionFailure('unavailable')
    const item = (value as Record<string, unknown>)[key]
    if (
      item !== null &&
      typeof item !== 'boolean' &&
      !(typeof item === 'number' && Number.isSafeInteger(item)) &&
      !(typeof item === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(item))
    )
      throw new CommandExecutionFailure('unavailable')
  }
  if (Buffer.byteLength(JSON.stringify(value)) > 8192)
    throw new CommandExecutionFailure('unavailable')
  return structuredClone(value) as SafeCommandResult
}
