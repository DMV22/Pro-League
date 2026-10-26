import {
  previewProject,
  assertPreviewDatabaseUrl,
  readPreviewIdentity,
  type PreviewIdentity,
} from '../../../src/server/db/preview-target'
import { verifyPreviewControlPlane } from '../../db/preview-preflight'
import { absent, type JsonClient } from '../http'
import type { PreviewRecord } from '../reconcile'
import type { StateCodec } from '../state'
import { atPreviewStage, PreviewFailure } from '../diagnostics'

type Branch = {
  id: string
  project_id: string
  parent_id?: string
  name: string
  expires_at?: string
}
type Annotation = { value: Record<string, string> }
type BranchResponse = { branch: Branch; annotation?: Annotation }
type Endpoint = {
  id: string
  project_id: string
  branch_id: string
  host: string
  type: string
  disabled?: boolean
}
const prefix = `/projects/${previewProject.id}`

export function createNeon(client: JsonClient, codec: StateCodec) {
  async function parent() {
    const { project } = await client.get<{
      project: { id: string; name: string; region_id: string; pg_version: number }
    }>(prefix)
    const { branch } = await client.get<BranchResponse>(
      `${prefix}/branches/${previewProject.parentBranchId}`,
    )
    if (
      project.id !== previewProject.id ||
      project.name !== 'proleague-preview' ||
      project.region_id !== 'aws-eu-central-1' ||
      project.pg_version !== 18
    )
      throw new Error('Preview project identity differs')
    if (
      branch.id !== previewProject.parentBranchId ||
      branch.name !== 'preview-empty' ||
      branch.parent_id
    )
      throw new Error('Empty parent identity differs')
  }
  async function branches() {
    const all: Branch[] = []
    let cursor = ''
    for (let page = 0; page < 20; page++) {
      const result = await client.get<{ branches: Branch[]; pagination?: { next?: string } }>(
        `${prefix}/branches?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      )
      all.push(...result.branches)
      const next = result.pagination?.next
      if (!next) return all
      if (next === cursor) throw new Error('Neon pagination stalled')
      cursor = next
    }
    throw new Error('Neon pagination limit reached')
  }
  async function owned(record: PreviewRecord) {
    const branch = record.identity
      ? await client
          .get<BranchResponse>(`${prefix}/branches/${record.identity.branchId}`)
          .catch((error) => {
            if (absent(error)) return undefined
            throw error
          })
      : undefined
    const match = branch ?? (await branches()).find((row) => row.name === `pr-${record.pr}`)
    if (!match) return undefined
    const result =
      'branch' in match ? match : await client.get<BranchResponse>(`${prefix}/branches/${match.id}`)
    if (
      result.branch.project_id !== previewProject.id ||
      result.branch.parent_id !== previewProject.parentBranchId ||
      result.branch.id === previewProject.parentBranchId ||
      result.branch.name !== `pr-${record.pr}` ||
      (record.identity && record.identity.branchId !== result.branch.id)
    )
      throw new PreviewFailure('neon-ownership', 'branch-identity-mismatch')
    if (!result.annotation) throw new PreviewFailure('neon-ownership', 'annotation-missing')
    if (!codec.owns(result.annotation.value, record.pr, record.expiresAt))
      throw new PreviewFailure('neon-ownership', 'annotation-mismatch')
    if (Date.parse(result.branch.expires_at ?? '') !== Date.parse(record.expiresAt))
      throw new PreviewFailure('neon-ownership', 'expiry-mismatch')
    return result.branch
  }
  async function endpoints(branch: string) {
    const result = await client.get<{ endpoints: Endpoint[] }>(`${prefix}/endpoints`)
    const matches = result.endpoints.filter(
      (endpoint) => endpoint.branch_id === branch && endpoint.type === 'read_write',
    )
    if (matches.length !== 1) throw new Error('Expected one read-write Preview endpoint')
    return matches[0]
  }
  async function verify(identity: PreviewIdentity, record: PreviewRecord) {
    readPreviewIdentity(JSON.stringify(identity))
    const branch = await owned(record)
    if (!branch || branch.id !== identity.branchId)
      throw new Error('Recorded Neon branch is missing')
    await atPreviewStage('neon-control-plane', () =>
      verifyPreviewControlPlane(identity, (path) => client.get<Record<string, unknown>>(path)),
    )
  }
  async function ownerUrl(branchId: string, endpointId: string, host: string, database: string) {
    const query = new URLSearchParams({
      branch_id: branchId,
      endpoint_id: endpointId,
      database_name: database,
      role_name: 'neondb_owner',
      pooled: 'false',
    })
    const { uri } = await client.get<{ uri: string }>(`${prefix}/connection_uri?${query}`)
    const url = new URL(uri)
    if (
      url.hostname !== host ||
      url.pathname !== `/${database}` ||
      url.username !== 'neondb_owner' ||
      !url.password ||
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.hash ||
      (url.port && url.port !== '5432') ||
      !['require', 'verify-full'].includes(url.searchParams.get('sslmode') ?? '') ||
      [...url.searchParams.keys()].some(
        (key) =>
          !['sslmode', 'channel_binding'].includes(key) ||
          url.searchParams.getAll(key).length !== 1,
      )
    )
      throw new Error('Neon owner connection identity differs')
    url.searchParams.set('sslmode', 'verify-full')
    return url.toString()
  }
  return {
    parent,
    branches,
    owned,
    verify,
    async unknownBranches(known: Set<string>) {
      return (await branches())
        .filter((branch) => branch.id !== previewProject.parentBranchId && !known.has(branch.id))
        .map((branch) => branch.id)
    },
    async parentUrl() {
      await parent()
      const { databases } = await client.get<{ databases: { name: string }[] }>(
        `${prefix}/branches/${previewProject.parentBranchId}/databases`,
      )
      if (databases.length !== 1 || databases[0].name !== 'neondb')
        throw new Error('Empty parent database inventory differs')
      const endpoint = await endpoints(previewProject.parentBranchId)
      if (endpoint.host !== previewProject.parentHost || endpoint.project_id !== previewProject.id)
        throw new Error('Empty parent endpoint differs')
      return ownerUrl(previewProject.parentBranchId, endpoint.id, endpoint.host, 'neondb')
    },
    async ensure(record: PreviewRecord): Promise<PreviewIdentity> {
      await atPreviewStage('neon-parent', () => parent())
      let branch = await atPreviewStage('neon-branch-lookup', () => owned(record))
      if (!branch) {
        if (record.identity) throw new PreviewFailure('neon-branch-lookup', 'branch-missing')
        const existing = await atPreviewStage('neon-branch-lookup', () => branches())
        if (existing.filter((row) => row.id !== previewProject.parentBranchId).length >= 2)
          throw new PreviewFailure('neon-branch-create', 'capacity-reached')
        // POST is deliberately not retried blindly. A signed creation annotation permits recovery.
        const created = await atPreviewStage('neon-branch-create', () =>
          client.post<BranchResponse>(`${prefix}/branches`, {
            branch: {
              name: `pr-${record.pr}`,
              parent_id: previewProject.parentBranchId,
              init_source: 'parent-data',
              expires_at: record.expiresAt.replace('.000Z', 'Z'),
            },
            endpoints: [
              {
                type: 'read_write',
                autoscaling_limit_min_cu: 0.25,
                autoscaling_limit_max_cu: 0.25,
              },
            ],
            annotation_value: codec.annotation(record.pr, record.expiresAt),
          }),
        )
        if (!/^br-[a-z0-9-]+$/.test(created.branch.id))
          throw new PreviewFailure('neon-branch-create', 'branch-identity-mismatch')
        branch = await atPreviewStage('neon-ownership', () =>
          owned({ ...record, identity: undefined }),
        )
        if (!branch || branch.id !== created.branch.id)
          throw new PreviewFailure('neon-ownership', 'created-branch-unconfirmed')
      }
      const endpoint = await atPreviewStage('neon-endpoint', () => endpoints(branch.id))
      const identity = readPreviewIdentity(
        JSON.stringify({
          projectId: previewProject.id,
          parentBranchId: previewProject.parentBranchId,
          branchId: branch.id,
          endpointId: endpoint.id,
          directHost: endpoint.host,
          pullRequest: record.pr,
          database: `proleague_golden_seed_pr_${record.pr}`,
        }),
      )
      await verify(identity, { ...record, identity })
      const { databases } = await atPreviewStage('neon-database-inventory', () =>
        client.get<{
          databases: { name: string; branch_id: string; owner_name: string }[]
        }>(`${prefix}/branches/${branch.id}/databases`),
      )
      const database = databases.find((row) => row.name === identity.database)
      if (databases.some((row) => !['neondb', identity.database].includes(row.name)))
        throw new PreviewFailure('neon-database-inventory', 'database-inventory-mismatch')
      if (database && (database.branch_id !== branch.id || database.owner_name !== 'neondb_owner'))
        throw new PreviewFailure('neon-database-inventory', 'database-owner-mismatch')
      if (!database)
        await atPreviewStage('neon-database-create', () =>
          client.post(`${prefix}/branches/${branch.id}/databases`, {
            database: { name: identity.database, owner_name: 'neondb_owner' },
          }),
        )
      return identity
    },
    async connection(identity: PreviewIdentity, record: PreviewRecord) {
      await verify(identity, record)
      return assertPreviewDatabaseUrl(
        await ownerUrl(
          identity.branchId,
          identity.endpointId,
          identity.directHost,
          identity.database,
        ),
        identity,
        'operations',
      )
    },
    async remove(record: PreviewRecord, assertClosed: () => Promise<void>) {
      await parent()
      const branch = await owned(record)
      if (!branch) return
      await assertClosed()
      await client.delete(`${prefix}/branches/${branch.id}`)
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          await client.get(`${prefix}/branches/${branch.id}`)
        } catch (error) {
          if (absent(error)) return
          throw error
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      throw new Error('Neon removal not yet confirmed')
    },
  }
}
