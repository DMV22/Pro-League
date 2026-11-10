import 'server-only'
import { auth, createClerkClient } from '@clerk/nextjs/server'
import { createClerkSession } from '../../modules/identity-access/infrastructure/clerk-session'
import { readAdminAuthConfig } from './config'
import type { AdminSessionPort } from '../../modules/identity-access/application/command-access-port'

export function getAdminSession(): AdminSessionPort {
  const config = readAdminAuthConfig()
  if (!config)
    return {
      async verify() {
        throw new Error('Admin authentication unavailable')
      },
    }
  return createClerkSession({
    async authenticate() {
      const verified = await auth({ acceptsToken: 'session_token', treatPendingAsSignedOut: true })
      return {
        userId: verified.userId,
        sessionId: verified.sessionId,
        sessionStatus: verified.sessionStatus,
        tokenType: verified.tokenType,
      }
    },
    async session(id) {
      const client = createClerkClient({
        secretKey: config.secretKey,
        publishableKey: config.publishableKey,
        telemetry: { disabled: true },
      })
      return client.sessions.getSession(id)
    },
  })
}
