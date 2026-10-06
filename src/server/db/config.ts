export type DatabaseUrlName = 'DATABASE_URL' | 'MIGRATION_DATABASE_URL'

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

export function readDatabaseUrl(
  name: DatabaseUrlName,
  environment: Record<string, string | undefined> = process.env,
): string {
  const value = environment[name]?.trim()

  if (!value || value.includes('replace-with-a-private-local-password')) {
    throw new Error(`${name} must be configured with a private database URL`)
  }

  let parsed: URL

  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL`)
  }

  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    !parsed.username ||
    parsed.pathname.length <= 1
  ) {
    throw new Error(`${name} must include a PostgreSQL host, user, and database`)
  }

  return value
}

export function assertLocalDatabaseUrl(url: string, name: DatabaseUrlName): void {
  if (!localHosts.has(new URL(url).hostname)) {
    throw new Error(`${name} must point to a local PostgreSQL host for this command`)
  }
}
