export type GoldenSeasonTarget = 'local' | 'ci' | 'preview'

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

export function assertGoldenSeasonTarget(
  connectionString: string | undefined,
  target: GoldenSeasonTarget,
  confirmedDatabase: string | undefined,
  previewPullRequest?: number,
): string {
  if (!connectionString) {
    throw new Error('SEED_DATABASE_URL is required; DATABASE_URL is never used for seed/reset')
  }

  let url: URL
  try {
    url = new URL(connectionString)
  } catch {
    throw new Error('SEED_DATABASE_URL must be a valid PostgreSQL URL')
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username) {
    throw new Error('SEED_DATABASE_URL must identify a PostgreSQL server and user')
  }

  const database = decodeURIComponent(url.pathname.slice(1))
  const expected =
    target === 'local'
      ? 'proleague_golden_seed'
      : target === 'ci'
        ? 'proleague_golden_seed_ci'
        : previewPullRequest && Number.isSafeInteger(previewPullRequest) && previewPullRequest > 0
          ? `proleague_golden_seed_pr_${previewPullRequest}`
          : undefined

  if (!expected || database !== expected || confirmedDatabase !== expected) {
    throw new Error(
      'Seed/reset requires a dedicated disposable database and --confirm-db=<exact database name>',
    )
  }

  if (target !== 'preview' && !localHosts.has(url.hostname)) {
    throw new Error('Local and CI Golden Season targets must use a local PostgreSQL host')
  }

  if (url.searchParams.has('options')) {
    throw new Error('SEED_DATABASE_URL must not override PostgreSQL session options')
  }

  return database
}
