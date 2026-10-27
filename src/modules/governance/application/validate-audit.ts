import { AuditFailure, type AuditEventDraft, type AuditPolicies } from './audit-port'

/** Fail closed, and snapshot evidence before the first asynchronous persistence operation. */
export function validateAudit(event: AuditEventDraft, policies: AuditPolicies): AuditEventDraft {
  const input = record(event, [
    'id',
    'actor',
    'action',
    'outcome',
    'source',
    'correlationKey',
    'commandKey',
    'reason',
    'targets',
    'supportingReferenceIds',
    'evidence',
  ])
  uuid(input.id)
  token(input.action)
  if (!Object.hasOwn(policies, input.action as string)) invalid()
  const policy = policies[input.action as string]
  if (!policy || typeof policy.requireReason !== 'boolean' || !Array.isArray(policy.changeFields))
    invalid()
  if (policy.requireReference !== undefined && typeof policy.requireReference !== 'boolean')
    invalid()
  if (
    policy.requireReference &&
    (!Array.isArray(input.supportingReferenceIds) || input.supportingReferenceIds.length === 0)
  )
    invalid()
  if (!['succeeded', 'denied', 'failed', 'requested'].includes(input.outcome as string)) invalid()
  if (!['admin', 'operator', 'job', 'webhook', 'system'].includes(input.source as string)) invalid()
  text(input.correlationKey, 128)
  if (input.commandKey !== undefined) text(input.commandKey, 128)
  if (policy.requireReason || input.reason !== undefined) text(input.reason, 2000)
  const actor = record(input.actor, ['kind', 'id', 'displayName', 'email'])
  text(actor.displayName, 200)
  if (actor.kind === 'admin') {
    uuid(actor.id)
    if (actor.email !== undefined) text(actor.email, 320)
  } else if (
    !['system', 'operator'].includes(actor.kind as string) ||
    actor.id !== undefined ||
    actor.email !== undefined
  )
    invalid()
  array(input.targets, 32)
  for (const value of input.targets as unknown[]) {
    const target = record(value, ['role', 'type', 'id', 'version', 'displayName'])
    if (!['primary', 'related', 'affected'].includes(target.role as string)) invalid()
    token(target.type)
    uuid(target.id)
    if (
      target.version !== undefined &&
      (typeof target.version !== 'bigint' ||
        target.version < 1n ||
        target.version > 9223372036854775807n)
    )
      invalid()
    if (target.displayName !== undefined) text(target.displayName, 200)
  }
  if (input.supportingReferenceIds !== undefined) {
    array(input.supportingReferenceIds, 8)
    for (const id of input.supportingReferenceIds as unknown[]) uuid(id)
  }
  if (input.evidence !== undefined) {
    const evidence = record(input.evidence, ['kind', 'schemaVersion', 'changes', 'type', 'id'])
    if (
      !Number.isSafeInteger(evidence.schemaVersion) ||
      (evidence.schemaVersion as number) < 1 ||
      (evidence.schemaVersion as number) > 2147483647
    )
      invalid()
    if (evidence.kind === 'diff') {
      if (evidence.type !== undefined || evidence.id !== undefined) invalid()
      array(evidence.changes, 32)
      const fields = new Set<string>()
      for (const value of evidence.changes as unknown[]) {
        const change = record(value, ['field', 'before', 'after'])
        token(change.field)
        const field = change.field as string
        if (
          !policy.changeFields.includes(field) ||
          /password|secret|token|cookie|authorization|credential|private.*content|raw.*payload/i.test(
            field,
          ) ||
          fields.has(field)
        )
          invalid()
        fields.add(field)
        scalar(change.before)
        scalar(change.after)
      }
    } else if (evidence.kind === 'revision') {
      if (evidence.changes !== undefined) invalid()
      token(evidence.type)
      uuid(evidence.id)
    } else invalid()
  }
  return structuredClone(event)
}

function invalid(): never {
  throw new AuditFailure('invalid')
}
function record(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  )
    invalid()
  for (const key of Reflect.ownKeys(value)) {
    if (
      typeof key !== 'string' ||
      !allowed.includes(key) ||
      !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, 'value')
    )
      invalid()
  }
  return value as Record<string, unknown>
}
function text(value: unknown, max: number): void {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0'))
    invalid()
}
function token(value: unknown): void {
  if (typeof value !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.:-]{0,95}$/.test(value)) invalid()
}
function uuid(value: unknown): void {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
    invalid()
}
function array(value: unknown, max: number): void {
  if (!Array.isArray(value) || value.length > max) invalid()
}
function scalar(value: unknown): void {
  if (value === null || typeof value === 'boolean') return
  if (typeof value === 'number' && Number.isFinite(value)) return
  if (typeof value === 'string' && value.length <= 512 && !value.includes('\0')) return
  invalid()
}
