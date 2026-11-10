import { expect, it, vi } from 'vitest'
import { createClerkSession } from './clerk-session'

it('accepts only the active provider session bound to the authenticated subject', async () => {
  const adapter = createClerkSession({
    async authenticate() {
      return {
        userId: 'user_synthetic',
        sessionId: 'sess_synthetic',
        sessionStatus: 'active',
        tokenType: 'session_token',
      }
    },
    async session() {
      return {
        id: 'sess_synthetic',
        userId: 'user_synthetic',
        status: 'active',
        createdAt: 1000,
        expireAt: Date.now() + 60000,
      }
    },
  })
  expect(await adapter.verify()).toEqual({
    subject: 'user_synthetic',
    sessionId: 'sess_synthetic',
    startedAt: 1000,
  })
})

it.each(['pending', 'revoked', 'expired', 'ended'])(
  'denies provider session state %s',
  async (status) => {
    expect(
      await createClerkSession({
        async authenticate() {
          return {
            userId: 'u',
            sessionId: 's',
            sessionStatus: 'active',
            tokenType: 'session_token',
          }
        },
        async session() {
          return { id: 's', userId: 'u', status, createdAt: 1000, expireAt: Date.now() + 60000 }
        },
      }).verify(),
    ).toBeNull()
  },
)

it.each([
  { userId: null, sessionId: null, sessionStatus: null, tokenType: 'session_token' },
  { userId: 'u', sessionId: 's', sessionStatus: 'pending', tokenType: 'session_token' },
  { userId: 'u', sessionId: 's', sessionStatus: 'active', tokenType: 'api_key' },
])('denies incomplete/non-user authentication without a backend lookup', async (proof) => {
  expect(
    await createClerkSession({
      async authenticate() {
        return proof
      },
      async session() {
        throw new Error('Backend must not be called')
      },
    }).verify(),
  ).toBeNull()
})

it.each([
  { id: 'other' },
  { userId: 'other' },
  { createdAt: NaN },
  { createdAt: 0 },
  { createdAt: Number.MAX_SAFE_INTEGER },
  { expireAt: 0 },
  { expireAt: NaN },
])('rejects inconsistent provider session evidence %j', async (override) => {
  expect(
    await createClerkSession({
      async authenticate() {
        return { userId: 'u', sessionId: 's', sessionStatus: 'active', tokenType: 'session_token' }
      },
      async session() {
        return {
          id: 's',
          userId: 'u',
          status: 'active',
          createdAt: 1000,
          expireAt: Date.now() + 60000,
          ...override,
        }
      },
    }).verify(),
  ).toBeNull()
})

it('does not cache successful sessions across verifications', async () => {
  let status = 'active'
  const adapter = createClerkSession({
    async authenticate() {
      return { userId: 'u', sessionId: 's', sessionStatus: 'active', tokenType: 'session_token' }
    },
    async session() {
      return { id: 's', userId: 'u', status, createdAt: 1000, expireAt: Date.now() + 60000 }
    },
  })
  expect(await adapter.verify()).not.toBeNull()
  status = 'revoked'
  expect(await adapter.verify()).toBeNull()
})

it('does not enable provider impersonation as an Admin login', async () => {
  expect(
    await createClerkSession({
      async authenticate() {
        return { userId: 'u', sessionId: 's', sessionStatus: 'active', tokenType: 'session_token' }
      },
      async session() {
        return {
          id: 's',
          userId: 'u',
          status: 'active',
          createdAt: 1000,
          expireAt: Date.now() + 60000,
          actor: { sub: 'another-user' },
        }
      },
    }).verify(),
  ).toBeNull()
})

it('reports provider uncertainty without leaking raw exceptions', async () => {
  await expect(
    createClerkSession({
      async authenticate() {
        return { userId: 'u', sessionId: 's', sessionStatus: 'active', tokenType: 'session_token' }
      },
      async session() {
        throw new Error('secret-bearing SDK exception')
      },
    }).verify(),
  ).rejects.toThrow('Authentication verification unavailable')
})

it('bounds the caller wait when the provider does not respond', async () => {
  vi.useFakeTimers()
  try {
    const adapter = createClerkSession({
      async authenticate() {
        return { userId: 'u', sessionId: 's', sessionStatus: 'active', tokenType: 'session_token' }
      },
      session: () => new Promise(() => {}),
    })
    const assertion = expect(adapter.verify()).rejects.toThrow(
      'Authentication verification unavailable',
    )
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
  } finally {
    vi.useRealTimers()
  }
})
