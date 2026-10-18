import assert from 'node:assert/strict'
import pg from 'pg'
import {
  assertPreviewDatabaseUrl,
  previewProject,
  readPreviewIdentity,
  type PreviewIdentity,
} from '../../src/server/db/preview-target'

type MetadataReader = (path: string) => Promise<Record<string, unknown>>

/** Control-plane validation precedes any SQL connection or write. */
export async function verifyPreviewControlPlane(identity: PreviewIdentity, read: MetadataReader) {
  const prefix = `/projects/${previewProject.id}`
  const [projectResult, parentResult, branchResult, endpointResult] = await Promise.all([
    read(prefix),
    read(`${prefix}/branches/${previewProject.parentBranchId}`),
    read(`${prefix}/branches/${identity.branchId}`),
    read(`${prefix}/endpoints/${identity.endpointId}`),
  ])
  const project = projectResult.project as Record<string, unknown>
  const parent = parentResult.branch as Record<string, unknown>
  const branch = branchResult.branch as Record<string, unknown>
  const endpoint = endpointResult.endpoint as Record<string, unknown>
  assert(project?.id === previewProject.id && project.name === 'proleague-preview')
  assert(project.pg_version === 18 && project.region_id === 'aws-eu-central-1')
  assert(
    parent?.id === previewProject.parentBranchId &&
      parent.name === 'preview-empty' &&
      !parent.parent_id,
  )
  assert(branch?.id === identity.branchId && branch.project_id === previewProject.id)
  assert(
    branch.name === `pr-${identity.pullRequest}` &&
      branch.parent_id === previewProject.parentBranchId,
  )
  assert(endpoint?.id === identity.endpointId && endpoint.project_id === previewProject.id)
  assert(endpoint.branch_id === identity.branchId && endpoint.host === identity.directHost)
  assert(endpoint.type === 'read_write' && !endpoint.disabled)
}

export async function readPreviewOperationsTarget(
  name: 'MIGRATION_DATABASE_URL' | 'SEED_DATABASE_URL',
  confirmedDatabase: string | undefined,
  pullRequest: number | undefined,
  environment: Record<string, string | undefined> = process.env,
) {
  const identity = readPreviewIdentity(environment.PREVIEW_DATABASE_IDENTITY)
  assert(
    identity.pullRequest === pullRequest && identity.database === confirmedDatabase,
    'Preview command requires matching --preview-pr and --confirm-db',
  )
  const connectionString = assertPreviewDatabaseUrl(environment[name], identity, 'operations')
  const token = environment.NEON_API_KEY?.trim()
  assert(
    token,
    'NEON_API_KEY is required for an authoritative Preview preflight; never install it in Render',
  )
  await verifyPreviewControlPlane(identity, async (path) => {
    const response = await fetch(`https://console.neon.tech/api/v2${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    })
    if (!response.ok)
      throw new Error(`Neon Preview metadata check failed (HTTP ${response.status})`)
    return (await response.json()) as Record<string, unknown>
  })
  return { connectionString, identity }
}

export async function assertPreviewSqlIdentity(
  client: Pick<pg.Client, 'query'>,
  identity: PreviewIdentity,
) {
  const result = await client.query<{ database: string; version: string }>(
    "SELECT current_database() AS database, current_setting('server_version_num') AS version",
  )
  assert(
    result.rows[0]?.database === identity.database,
    'SQL database identity differs from the Preview binding',
  )
  assert(
    Math.floor(Number(result.rows[0]?.version) / 10_000) === 18,
    'Preview requires PostgreSQL 18',
  )
}
