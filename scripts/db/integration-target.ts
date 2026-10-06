export type IntegrationTarget = 'local' | 'ci'

export function assertIntegrationTarget(
  connectionString: string | undefined,
  target: IntegrationTarget,
  confirmation: string | undefined,
): string {
  if (!connectionString) {
    throw new Error('INTEGRATION_DATABASE_URL is required; application URLs are never used')
  }

  let url: URL
  try {
    url = new URL(connectionString)
  } catch {
    throw new Error('INTEGRATION_DATABASE_URL must be a valid PostgreSQL URL')
  }

  const expected = target === 'ci' ? 'proleague_integration_ci' : 'proleague_integration'
  const database = decodeURIComponent(url.pathname.slice(1))
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !url.username ||
    url.search.length > 0 ||
    url.hash.length > 0 ||
    database !== expected ||
    confirmation !== expected
  ) {
    throw new Error(
      `Integration tests require loopback database ${expected} and --confirm-db=${expected}`,
    )
  }
  return connectionString
}
