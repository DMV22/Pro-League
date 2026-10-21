// Non-secret trust anchor. Never substitute a Development/Production project here.
export const previewProject = {
  id: 'long-sea-15202409',
  parentBranchId: 'br-divine-leaf-b90tlpj2',
  parentHost: 'ep-still-pond-b9silqx7.c-7.eu-central-1.aws.neon.tech',
} as const

export type PreviewIdentity = {
  projectId: string
  parentBranchId: string
  branchId: string
  endpointId: string
  directHost: string
  pullRequest: number
  database: string
}

export class PreviewConfigurationError extends Error {
  constructor() {
    super('Preview database configuration is missing or does not match the isolated PR target')
    this.name = 'PreviewConfigurationError'
  }
}

function requireMatch(condition: unknown): asserts condition {
  if (!condition) throw new PreviewConfigurationError()
}

export function isRenderPreview(environment: Record<string, string | undefined> = process.env) {
  return (
    environment.IS_PULL_REQUEST === 'true' ||
    /-pr-\d+\.onrender\.com$/i.test(environment.RENDER_EXTERNAL_HOSTNAME ?? '') ||
    /-pr-\d+\.onrender\.com(?:\/|$)/i.test(environment.RENDER_EXTERNAL_URL ?? '')
  )
}

/** Parse the non-secret binding produced by the authoritative Neon preflight. */
export function readPreviewIdentity(value: string | undefined): PreviewIdentity {
  let input: unknown
  try {
    input = JSON.parse(value ?? '')
  } catch {
    throw new PreviewConfigurationError()
  }
  requireMatch(input && typeof input === 'object')
  const candidate = input as Partial<PreviewIdentity>
  requireMatch(candidate.projectId === previewProject.id)
  requireMatch(candidate.parentBranchId === previewProject.parentBranchId)
  requireMatch(
    typeof candidate.branchId === 'string' &&
      /^br-[a-z0-9-]+$/.test(candidate.branchId) &&
      candidate.branchId !== previewProject.parentBranchId,
  )
  requireMatch(
    typeof candidate.endpointId === 'string' && /^ep-[a-z0-9-]+$/.test(candidate.endpointId),
  )
  requireMatch(
    candidate.directHost === `${candidate.endpointId}.c-7.eu-central-1.aws.neon.tech` &&
      candidate.directHost !== previewProject.parentHost,
  )
  requireMatch(
    Number.isSafeInteger(candidate.pullRequest) &&
      Number(candidate.pullRequest) > 0 &&
      candidate.database === `proleague_golden_seed_pr_${candidate.pullRequest}`,
  )
  return candidate as PreviewIdentity
}

/** Validate before any connection: query parameters must not override the pinned target. */
export function assertPreviewDatabaseUrl(
  value: string | undefined,
  identity: PreviewIdentity,
  purpose: 'runtime' | 'operations',
): string {
  let url: URL
  try {
    url = new URL(value ?? '')
  } catch {
    throw new PreviewConfigurationError()
  }
  const runtime = purpose === 'runtime'
  const expectedHost = runtime
    ? identity.directHost.replace(`${identity.endpointId}.`, `${identity.endpointId}-pooler.`)
    : identity.directHost
  requireMatch(['postgres:', 'postgresql:'].includes(url.protocol))
  requireMatch(url.hostname === expectedHost && (!url.port || url.port === '5432'))
  requireMatch(
    url.pathname === `/${identity.database}` && url.username && url.password && !url.hash,
  )
  requireMatch(
    url.searchParams.getAll('sslmode').length === 1 &&
      url.searchParams.get('sslmode') === 'verify-full',
  )
  for (const key of url.searchParams.keys()) {
    requireMatch(
      ['sslmode', 'channel_binding'].includes(key) && url.searchParams.getAll(key).length === 1,
    )
  }
  if (url.searchParams.has('channel_binding'))
    requireMatch(url.searchParams.get('channel_binding') === 'require')
  if (runtime) requireMatch(url.username === `preview_reader_pr_${identity.pullRequest}`)
  else requireMatch(url.username !== `preview_reader_pr_${identity.pullRequest}`)
  return value!
}

export function assertPreviewRuntime(
  databaseUrl: string | undefined,
  environment: Record<string, string | undefined> = process.env,
): void {
  if (!isRenderPreview(environment)) return
  requireMatch(environment.IS_PULL_REQUEST === 'true')
  const identity = readPreviewIdentity(environment.PREVIEW_DATABASE_IDENTITY)
  const expectedHostname = `pro-league-development-pr-${identity.pullRequest}.onrender.com`
  requireMatch(environment.RENDER_EXTERNAL_HOSTNAME === expectedHostname)
  requireMatch(environment.RENDER_EXTERNAL_URL === `https://${expectedHostname}`)
  assertPreviewDatabaseUrl(databaseUrl, identity, 'runtime')
}
