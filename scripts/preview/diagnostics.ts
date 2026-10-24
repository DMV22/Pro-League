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
] as const

export type PreviewStage = (typeof stages)[number]

/** Only fixed labels and a validated numeric code may cross the CLI logging boundary. */
export function safePreviewFailure(stage: PreviewStage, error: unknown) {
  const safeStage = stages.includes(stage) ? stage : 'unknown'
  const status = error instanceof ProviderError ? error.status : undefined
  const http =
    typeof status === 'number' &&
    Number.isInteger(status) &&
    (status === 0 || (status >= 100 && status <= 599))
      ? status
      : 'unknown'
  return `::error::Isolated Preview operation failed [stage=${safeStage}; http=${http}]. Check PR state, approved digest, resource ownership, capacity and provider availability. Do not reset or attach a shared database.`
}
