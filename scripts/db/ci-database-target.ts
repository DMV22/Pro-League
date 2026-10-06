const allowedNames = new Set([
  'proleague_integration_ci',
  'proleague_migration_ci',
  'proleague_reference_ci',
  'proleague_golden_seed_ci',
  'proleague_upgrade_ci',
])

export function assertCiDatabaseTarget(
  connectionString: string | undefined,
  confirmation: string | undefined,
): { url: string; database: string } {
  if (!connectionString) throw new Error('MIGRATION_DATABASE_URL is required')
  let parsed: URL
  try {
    parsed = new URL(connectionString)
  } catch {
    throw new Error('MIGRATION_DATABASE_URL must be a valid PostgreSQL URL')
  }
  const database = decodeURIComponent(parsed.pathname.slice(1))
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
    !parsed.username ||
    parsed.search ||
    parsed.hash ||
    !allowedNames.has(database) ||
    confirmation !== database
  ) {
    throw new Error('CI DB command requires a confirmed, dedicated, loopback PostgreSQL database')
  }
  return { url: connectionString, database }
}
