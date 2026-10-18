import { describe, expect, it } from 'vitest'
import { verifyPreviewControlPlane } from './preview-preflight'
import { previewProject, type PreviewIdentity } from '../../src/server/db/preview-target'

const identity: PreviewIdentity = {
  projectId: previewProject.id,
  parentBranchId: previewProject.parentBranchId,
  branchId: 'br-test-child',
  endpointId: 'ep-test-child',
  directHost: 'ep-test-child.c-7.eu-central-1.aws.neon.tech',
  pullRequest: 105,
  database: 'proleague_golden_seed_pr_105',
}
const records = {
  project: {
    id: previewProject.id,
    name: 'proleague-preview',
    pg_version: 18,
    region_id: 'aws-eu-central-1',
  },
  parent: { id: previewProject.parentBranchId, name: 'preview-empty' },
  branch: {
    id: identity.branchId,
    project_id: previewProject.id,
    name: 'pr-105',
    parent_id: String(previewProject.parentBranchId),
  },
  endpoint: {
    id: identity.endpointId,
    project_id: previewProject.id,
    branch_id: identity.branchId,
    host: identity.directHost,
    type: 'read_write',
    disabled: false,
  },
}
const read =
  (data = records) =>
  async (path: string) =>
    path.endsWith(identity.endpointId)
      ? { endpoint: data.endpoint }
      : path.endsWith(identity.branchId)
        ? { branch: data.branch }
        : path.endsWith(previewProject.parentBranchId)
          ? { branch: data.parent }
          : { project: data.project }

describe('Preview authoritative preflight', () => {
  it('accepts only a matching child of the pinned empty Preview parent', async () => {
    await expect(verifyPreviewControlPlane(identity, read())).resolves.toBeUndefined()
  })
  it('rejects a named PR branch from another parent', async () => {
    await expect(
      verifyPreviewControlPlane(
        identity,
        read({ ...records, branch: { ...records.branch, parent_id: 'br-production' } }),
      ),
    ).rejects.toThrow()
  })
  it('rejects an endpoint that belongs to another branch', async () => {
    await expect(
      verifyPreviewControlPlane(
        identity,
        read({ ...records, endpoint: { ...records.endpoint, branch_id: 'br-development' } }),
      ),
    ).rejects.toThrow()
  })
  it('does not treat provider errors as successful verification', async () => {
    await expect(
      verifyPreviewControlPlane(identity, async () => {
        throw new Error('offline')
      }),
    ).rejects.toThrow('offline')
  })
})
