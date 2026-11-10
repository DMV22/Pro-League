import type { AdminSessionPort } from '../application/command-access-port'

/** Narrow external SDK seam: production Clerk and synthetic test adapter. */
export function createClerkSession(provider: {
  authenticate(): Promise<{
    userId: string | null
    sessionId: string | null
    sessionStatus: string | null
    tokenType: string | null
  }>
  session(id: string): Promise<{
    id: string
    userId: string
    status: string
    createdAt: number
    expireAt: number
    actor?: unknown
  }>
}): AdminSessionPort {
  return {
    async verify() {
      let deadline: ReturnType<typeof setTimeout> | undefined
      try {
        const verify = async () => {
          const auth = await provider.authenticate()
          if (
            !auth.userId ||
            !auth.sessionId ||
            auth.sessionStatus !== 'active' ||
            auth.tokenType !== 'session_token'
          )
            return null
          // Online proof gives a trusted creation time and observes provider revocation.
          // Never use token iat, client data, or a cross-request cached success here.
          const session = await provider.session(auth.sessionId)
          if (
            session.id !== auth.sessionId ||
            session.userId !== auth.userId ||
            session.status !== 'active' ||
            session.actor != null ||
            !Number.isSafeInteger(session.createdAt) ||
            session.createdAt <= 0 ||
            session.createdAt > Date.now() ||
            !Number.isSafeInteger(session.expireAt) ||
            session.expireAt <= Date.now()
          )
            return null
          return { subject: auth.userId, sessionId: auth.sessionId, startedAt: session.createdAt }
        }
        // Bounds the caller wait; this does not claim cancellation of SDK network retries.
        return await Promise.race([
          verify(),
          new Promise<never>((_resolve, reject) => {
            deadline = setTimeout(() => reject(new Error('Provider deadline')), 5000)
          }),
        ])
      } catch {
        throw new Error('Authentication verification unavailable')
      } finally {
        if (deadline) clearTimeout(deadline)
      }
    },
  }
}
