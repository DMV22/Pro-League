import { and, eq, sql } from 'drizzle-orm'
import type { CommandAccessPort } from '../application/command-access-port'
import type { DatabaseTransaction } from '../../../server/db/transaction-types'
import { adminIdentities, adminExternalIdentities, adminAccessGrants } from './schema'

export function createCommandAccess(tx: DatabaseTransaction): CommandAccessPort {
  return {
    async authorize(session) {
      if (!session.subject || !session.sessionId) return null
      // Lock mapping, identity, then grant. Revocation/suspension writers must honor this order.
      const [mapping] = await tx
        .select({ identityId: adminExternalIdentities.adminIdentityId })
        .from(adminExternalIdentities)
        .where(
          and(
            eq(adminExternalIdentities.provider, 'clerk'),
            eq(adminExternalIdentities.providerUserId, session.subject),
          ),
        )
        .for('share')
      if (!mapping) return null
      const [identity] = await tx
        .select({
          id: adminIdentities.id,
          name: adminIdentities.displayName,
          email: adminIdentities.contactEmail,
          state: adminIdentities.lifecycleState,
        })
        .from(adminIdentities)
        .where(eq(adminIdentities.id, mapping.identityId))
        .for('share')
      if (!identity || identity.state !== 'active') return null
      const [grant] = await tx
        .select({ id: adminAccessGrants.id })
        .from(adminAccessGrants)
        .where(
          and(
            eq(adminAccessGrants.adminIdentityId, identity.id),
            eq(adminAccessGrants.state, 'active'),
            sql`${adminAccessGrants.effectiveAt} <= clock_timestamp()`,
            sql`${adminAccessGrants.endedAt} is null`,
          ),
        )
        .for('share')
      if (!grant) return null
      return {
        actor: {
          kind: 'admin',
          adminIdentityId: identity.id,
          accessGrantId: grant.id,
          sessionId: session.sessionId,
        },
        displayName: identity.name,
        email: identity.email,
      }
    },
  }
}
