import { expect, it, vi } from 'vitest'
import { atPreviewStage, PreviewFailure, safePreviewFailure } from './diagnostics'
import { ProviderError } from './http'
import { reconcilePreview, type PreviewRecord, type PreviewSystems } from './reconcile'
import { createNeon } from './providers/neon'
import { createStateCodec } from './state'
import { previewProject } from '../../src/server/db/preview-target'

const secret = 'postgresql://owner:TEST-SECRET@private.example/db?token=private'
const record: PreviewRecord = {
  pr: 123,
  sha: 'a'.repeat(40),
  phase: 'reserved',
  expiresAt: '2026-11-02T17:54:15.000Z',
}

it('preserves the innermost HTTP diagnostic but drops raw error properties and causes', async () => {
  const error = Object.assign(new ProviderError(503), { message: secret, cause: secret })
  const failure = await atPreviewStage('allocation-lease', () =>
    atPreviewStage('neon-branch-create', async () => {
      throw error
    }),
  ).catch((error) => error)
  const log = safePreviewFailure('reconcile', failure)
  expect(log).toContain('stage=neon-branch-create; http=503; reason=operation-failed')
  expect(JSON.stringify(failure) + failure.message + log).not.toContain(secret)
  expect(failure.cause).toBeUndefined()
})

it('refuses arbitrary diagnostic labels and HTTP values at the logging boundary', () => {
  const spoof = { stage: secret, reason: secret, status: 500, message: secret }
  expect(safePreviewFailure('reconcile', spoof)).toContain('stage=reconcile; http=unknown')
  const typed = new PreviewFailure(secret as never, secret as never, Number.NaN)
  const log = safePreviewFailure('reconcile', typed)
  expect(log).toContain('stage=unknown; http=unknown; reason=operation-failed')
  expect(log).not.toContain(secret)
})

it('keeps the primary allocation diagnostic when failure status publishing also fails', async () => {
  const pr = {
    number: 123,
    sha: record.sha,
    state: 'open',
    base: 'develop',
    repository: 'DMV22/Pro-League',
    headRepository: 'DMV22/Pro-League',
  } as const
  let reserved: PreviewRecord | undefined
  const prepare = vi.fn()
  const bind = vi.fn()
  const remove = vi.fn()
  const systems: PreviewSystems = {
    current: async () => pr,
    files: async () => ['src/app/page.tsx'],
    record: async () => undefined,
    save: async (r) => {
      reserved = { ...r }
    },
    database: async () => {
      throw new PreviewFailure('neon-ownership', 'annotation-missing')
    },
    status: async (_pr, state) => {
      if (state === 'failure') throw new Error(secret)
    },
    prepare,
    bind,
    remove,
    verify: vi.fn(),
    alert: vi.fn(),
    now: () => new Date('2026-10-26T12:00:00Z'),
  }
  const failure = await reconcilePreview(pr, systems).catch((error) => error)
  expect(safePreviewFailure('reconcile', failure)).toContain(
    'stage=neon-ownership; http=unknown; reason=annotation-missing',
  )
  expect(reserved?.phase).toBe('reserved')
  expect(reserved?.identity).toBeUndefined()
  expect(prepare).not.toHaveBeenCalled()
  expect(bind).not.toHaveBeenCalled()
  expect(remove).not.toHaveBeenCalled()
})

it.each(['missing', 'signature', 'expiry'] as const)(
  'fails closed with a safe ownership reason for %s annotation metadata',
  async (mode) => {
    const codec = createStateCodec('12'.repeat(32))
    const branch = {
      id: 'br-test123',
      project_id: previewProject.id,
      parent_id: previewProject.parentBranchId,
      name: 'pr-123',
      expires_at: mode === 'expiry' ? '2026-11-03T17:54:15Z' : record.expiresAt,
    }
    const annotation = codec.annotation(record.pr, record.expiresAt)
    if (mode === 'signature') annotation.signature = secret
    const post = vi.fn()
    const client = {
      get: vi.fn(async (path: string) => {
        if (path.endsWith('/branches/br-test123'))
          return { branch, ...(mode === 'missing' ? {} : { annotation: { value: annotation } }) }
        if (path.includes('/branches?')) return { branches: [branch] }
        if (path.endsWith(`/branches/${previewProject.parentBranchId}`))
          return { branch: { id: previewProject.parentBranchId, name: 'preview-empty' } }
        return {
          project: {
            id: previewProject.id,
            name: 'proleague-preview',
            region_id: 'aws-eu-central-1',
            pg_version: 18,
          },
        }
      }),
      post,
    }
    const neon = createNeon(client as never, codec)
    const failure = await neon.ensure(record).catch((error) => error)
    const reason =
      mode === 'missing'
        ? 'annotation-missing'
        : mode === 'signature'
          ? 'annotation-mismatch'
          : 'expiry-mismatch'
    expect(safePreviewFailure('reconcile', failure)).toContain(
      `stage=neon-ownership; http=unknown; reason=${reason}`,
    )
    expect(safePreviewFailure('reconcile', failure)).not.toContain(secret)
    expect(post).not.toHaveBeenCalled()
  },
)

it('retains a newly created branch on failed ownership verification and never blindly creates again', async () => {
  let created = false
  const branch = {
    id: 'br-test123',
    project_id: previewProject.id,
    parent_id: previewProject.parentBranchId,
    name: 'pr-123',
    expires_at: record.expiresAt,
  }
  const post = vi.fn(async () => {
    created = true
    return { branch }
  })
  const get = vi.fn(async (path: string) => {
    if (path.endsWith('/branches/br-test123')) return { branch }
    if (path.includes('/branches?')) return { branches: created ? [branch] : [] }
    if (path.endsWith(`/branches/${previewProject.parentBranchId}`))
      return { branch: { id: previewProject.parentBranchId, name: 'preview-empty' } }
    return {
      project: {
        id: previewProject.id,
        name: 'proleague-preview',
        region_id: 'aws-eu-central-1',
        pg_version: 18,
      },
    }
  })
  const remove = vi.fn()
  const neon = createNeon({ get, post, delete: remove } as never, createStateCodec('12'.repeat(32)))
  for (let attempt = 0; attempt < 2; attempt++) {
    const failure = await neon.ensure(record).catch((error) => error)
    expect(safePreviewFailure('reconcile', failure)).toContain('reason=annotation-missing')
  }
  expect(post).toHaveBeenCalledTimes(1)
  expect(remove).not.toHaveBeenCalled()
})
