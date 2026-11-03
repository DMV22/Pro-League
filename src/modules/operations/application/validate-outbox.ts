import { OutboxFailure, type OutboxIntent, type OutboxPolicies } from './outbox-port'

/** Accept only small, registered server projections; this is not arbitrary JSON or automatic DLP. */
export function validateOutbox(input: OutboxIntent, policies: OutboxPolicies): OutboxIntent {
  const event = record(input, [
    'id',
    'messageType',
    'schemaVersion',
    'payload',
    'aggregateType',
    'aggregateId',
    'aggregateVersion',
    'correlationKey',
    'causationKey',
  ])
  uuid(event.id)
  uuid(event.aggregateId)
  token(event.messageType)
  token(event.aggregateType)
  token(event.correlationKey, 128)
  token(event.causationKey, 128)
  if (
    typeof event.aggregateVersion !== 'bigint' ||
    event.aggregateVersion < 1n ||
    event.aggregateVersion > 9223372036854775807n
  )
    invalid()
  if (!Object.hasOwn(policies, event.messageType as string)) invalid()
  const policy = policies[event.messageType as string]
  if (
    !policy ||
    !Number.isSafeInteger(event.schemaVersion) ||
    (event.schemaVersion as number) < 1 ||
    (event.schemaVersion as number) > 2147483647 ||
    policy.schemaVersion !== event.schemaVersion ||
    !Array.isArray(policy.payloadFields) ||
    policy.payloadFields.length > 16
  )
    invalid()
  const payload = record(event.payload, policy.payloadFields)
  if (Object.keys(payload).length !== policy.payloadFields.length) invalid()
  for (const [key, value] of Object.entries(payload)) {
    token(key)
    if (
      /password|secret|token|cookie|authorization|credential|private.*content|raw.*payload/i.test(
        key,
      )
    )
      invalid()
    if (typeof value === 'string') token(value, 128)
    else if (
      value !== null &&
      typeof value !== 'boolean' &&
      !(typeof value === 'number' && Number.isSafeInteger(value))
    )
      invalid()
  }
  // Rebuild only validated own data, snapshot before asynchronous persistence.
  return {
    ...input,
    id: input.id.toLowerCase(),
    aggregateId: input.aggregateId.toLowerCase(),
    payload: { ...payload } as OutboxIntent['payload'],
  }
}

function invalid(): never {
  throw new OutboxFailure('invalid')
}
function token(value: unknown, max = 96): void {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)
  )
    invalid()
}
function uuid(value: unknown): void {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
    invalid()
}
function record(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    invalid()
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!
    if (
      typeof key !== 'string' ||
      !fields.includes(key) ||
      !Object.hasOwn(descriptor, 'value') ||
      !descriptor.enumerable
    )
      invalid()
  }
  return value as Record<string, unknown>
}
