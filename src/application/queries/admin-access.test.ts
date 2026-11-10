import { expect, it } from 'vitest'
import { readAdminAccess } from './admin-access'

it('does not turn failed provider verification into an authorized read', async () => {
  expect(
    await readAdminAccess({
      session: {
        async verify() {
          throw new Error('private provider error')
        },
      },
      access: () => {
        throw new Error('Must not initialize persistence')
      },
    }),
  ).toEqual({ status: 'unavailable', code: 'authorization_unavailable' })
})

it('denies signed-out reads before persistence is initialized', async () => {
  expect(
    await readAdminAccess({
      session: {
        async verify() {
          return null
        },
      },
      access: () => {
        throw new Error('Must not connect')
      },
    }),
  ).toEqual({ status: 'unauthenticated' })
})

it('rechecks local access instead of caching an earlier allow', async () => {
  let active = true
  const dependencies = {
    session: {
      async verify() {
        return { subject: 'u', sessionId: 's', startedAt: 1000 }
      },
    },
    access: () => ({
      async authorize() {
        return active
          ? {
              actor: {
                kind: 'admin' as const,
                adminIdentityId: 'identity',
                accessGrantId: 'grant',
                sessionId: 's',
              },
              displayName: 'Synthetic',
              email: 'private@example.invalid',
            }
          : null
      },
    }),
  }
  const first = await readAdminAccess(dependencies)
  expect(first).toEqual({
    status: 'authorized',
    actor: { kind: 'admin', adminIdentityId: 'identity', accessGrantId: 'grant', sessionId: 's' },
    displayName: 'Synthetic',
  })
  active = false
  expect(await readAdminAccess(dependencies)).toEqual({
    status: 'forbidden',
    code: 'access_denied',
  })
})

it('fails closed when local persistence cannot establish authorization', async () => {
  expect(
    await readAdminAccess({
      session: {
        async verify() {
          return { subject: 'u', sessionId: 's', startedAt: 1000 }
        },
      },
      access: () => ({
        async authorize() {
          throw new Error('private database failure')
        },
      }),
    }),
  ).toEqual({ status: 'unavailable', code: 'authorization_unavailable' })
})
