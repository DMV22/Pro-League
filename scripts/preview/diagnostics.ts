import { ProviderError } from './http'

const stages = [
  'bootstrap',
  'environment',
  'pr-metadata',
  'inspect-files',
  'inspect-plan',
  'status-publish',
  'baseline-ci',
  'migration-bundle',
  'ownership-record',
  'review',
  'provider-init',
  'sweep',
  'recreate',
  'reconcile',
  'allocation-baseline',
  'allocation-policy',
  'render-base',
  'neon-parent',
  'allocation-lease',
  'neon-branch-lookup',
  'neon-branch-create',
  'neon-ownership',
  'neon-endpoint',
  'neon-control-plane',
  'neon-database-inventory',
  'neon-database-create',
  'prepare',
  'bind',
  'verify',
  'record-save',
] as const

export type PreviewStage = (typeof stages)[number]

const reasons = [
  'operation-failed',
  'branch-identity-mismatch',
  'annotation-missing',
  'annotation-mismatch',
  'expiry-mismatch',
  'created-branch-unconfirmed',
  'branch-missing',
  'capacity-reached',
  'database-inventory-mismatch',
  'database-owner-mismatch',
] as const
type PreviewReason = (typeof reasons)[number]

/** Carries only allowlisted labels and an HTTP status, never an upstream error/cause. */
export class PreviewFailure extends Error {
  constructor(
    readonly stage: PreviewStage,
    readonly reason: PreviewReason = 'operation-failed',
    readonly status?: number,
  ) {
    super('Preview preparation failed; resources retained for diagnosis, no reset performed')
  }
}

export function previewFailure(stage: PreviewStage, error: unknown): PreviewFailure {
  return error instanceof PreviewFailure
    ? error
    : new PreviewFailure(
        stage,
        'operation-failed',
        error instanceof ProviderError ? error.status : undefined,
      )
}

export async function atPreviewStage<T>(stage: PreviewStage, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw previewFailure(stage, error)
  }
}

/** Only fixed labels and a validated numeric code may cross the CLI logging boundary. */
export function safePreviewFailure(stage: PreviewStage, error: unknown) {
  const failedStage = error instanceof PreviewFailure ? error.stage : stage
  const safeStage = stages.includes(failedStage) ? failedStage : 'unknown'
  const reason =
    error instanceof PreviewFailure && reasons.includes(error.reason)
      ? error.reason
      : 'operation-failed'
  const status =
    error instanceof ProviderError || error instanceof PreviewFailure ? error.status : undefined
  const http =
    typeof status === 'number' &&
    Number.isInteger(status) &&
    (status === 0 || (status >= 100 && status <= 599))
      ? status
      : 'unknown'
  return `::error::Isolated Preview operation failed [stage=${safeStage}; http=${http}; reason=${reason}]. Check PR state, approved digest, resource ownership, capacity and provider availability. Do not reset or attach a shared database.`
}
