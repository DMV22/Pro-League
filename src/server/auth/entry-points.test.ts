import { expect, it, vi, afterEach } from 'vitest'
vi.mock('server-only', () => ({}))
const external = vi.hoisted(() => ({
  signedIn: false,
  providerFailed: false,
  databaseFailed: false,
  allowed: false,
}))
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => {
    if (external.providerFailed) throw new Error('private SDK error')
    return {
      userId: external.signedIn ? 'synthetic-user' : null,
      sessionId: external.signedIn ? 'synthetic-session' : null,
      sessionStatus: external.signedIn ? 'active' : null,
      tokenType: 'session_token',
    }
  },
  createClerkClient: () => ({
    sessions: {
      getSession: async () => ({
        id: 'synthetic-session',
        userId: 'synthetic-user',
        status: 'active',
        createdAt: 1000,
        expireAt: Date.now() + 60000,
      }),
    },
  }),
}))
// External PostgreSQL driver seam only; real SQL predicates/races are exercised by db:integration.
vi.mock('pg', () => ({
  default: {
    Pool: class {
      on() {
        return this
      }
      async query() {
        if (external.databaseFailed) throw new Error('private SQL error')
        return {
          rows: external.allowed
            ? [
                [
                  'synthetic-identity',
                  'synthetic-grant',
                  'Synthetic Admin',
                  'private@example.invalid',
                ],
              ]
            : [],
        }
      }
    },
  },
}))
import { GET } from '../../app/api/admin/access/route'
import { checkAdminAccessAction } from '../../app/(admin)/admin/actions'
import { executeProtectedAdminCommand } from '../commands/admin-command'

afterEach(() => {
  vi.unstubAllEnvs()
  Object.assign(external, {
    signedIn: false,
    providerFailed: false,
    databaseFailed: false,
    allowed: false,
  })
})

function enable() {
  vi.stubEnv('ADMIN_AUTH_ENABLED', 'true')
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_synthetic')
  vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_synthetic')
  vi.stubEnv('ADMIN_AUTH_ORIGINS', 'http://localhost:3000')
  vi.stubEnv('DATABASE_URL', 'postgresql://synthetic:synthetic@127.0.0.1/proleague_integration_ci')
}

it('configured direct entry points deny a signed-out caller without using unavailable persistence', async () => {
  enable()
  external.databaseFailed = true
  expect((await GET()).status).toBe(401)
  expect(await checkAdminAccessAction()).toEqual({ status: 'unauthenticated' })
})

it('configured direct entry points deny a valid session without local access', async () => {
  enable()
  external.signedIn = true
  expect((await GET()).status).toBe(403)
  expect(await checkAdminAccessAction()).toEqual({ status: 'forbidden', code: 'access_denied' })
})

it.each(['provider', 'database'])(
  'configured direct entry points fail closed on %s uncertainty',
  async (failure) => {
    enable()
    external.signedIn = true
    external.providerFailed = failure === 'provider'
    external.databaseFailed = failure === 'database'
    const response = await GET()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      status: 'unavailable',
      code: 'authorization_unavailable',
    })
    expect(await checkAdminAccessAction()).toEqual({
      status: 'unavailable',
      code: 'authorization_unavailable',
    })
  },
)

it('configured direct entry points expose only the narrow authorized DTO', async () => {
  enable()
  external.signedIn = true
  external.allowed = true
  const response = await GET()
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ status: 'authorized', displayName: 'Synthetic Admin' })
  expect(await checkAdminAccessAction()).toEqual({
    status: 'authorized',
    displayName: 'Synthetic Admin',
  })
})

it('direct Route Handler and Server Action calls remain closed without the layout or keys', async () => {
  vi.stubEnv('ADMIN_AUTH_ENABLED', 'false')
  const response = await GET()
  expect(response.status).toBe(503)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(await response.json()).toEqual({
    status: 'unavailable',
    code: 'authorization_unavailable',
  })
  expect(await checkAdminAccessAction()).toEqual({
    status: 'unavailable',
    code: 'authorization_unavailable',
  })
})

it('direct command composition cannot activate synthetic persistence in an unconfigured environment', async () => {
  vi.stubEnv('ADMIN_AUTH_ENABLED', 'false')
  expect(
    await executeProtectedAdminCommand(
      {
        type: 'test.only',
        version: 1,
        resultFields: [],
        validate: () => {
          throw new Error('Must not validate or mutate')
        },
        run: async () => {
          throw new Error('Must not execute')
        },
      },
      {},
      { correlationKey: 'synthetic' },
    ),
  ).toEqual({ status: 'unavailable', code: 'authorization_unavailable' })
})
