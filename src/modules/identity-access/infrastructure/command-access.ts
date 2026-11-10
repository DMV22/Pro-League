import { and, eq, sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import type { AdminAccessPort, CommandAccessPort } from '../application/command-access-port'
import type { Database, DatabaseTransaction } from '../../../server/db/transaction-types'
import {
  adminIdentities,
  adminExternalIdentities,
  adminAccessGrants,
  adminSessions,
  adminAccessStateTransitions,
} from './schema'

/** Read-only snapshot; never exposes a command-locking promise on a bare database. */
export function createLocalAdminAccess(database: Database): AdminAccessPort {
  return createAccess(database, false)
}

/** Requires the transaction that owns all authorization locks through commit. */
export function createCommandAccess(transaction: DatabaseTransaction): CommandAccessPort {
  return createAccess(transaction, true)
}

function createAccess(tx: Database | DatabaseTransaction, lock: boolean): AdminAccessPort {
  return {
    async authorize(session) {
      if (
        !session.subject ||
        !session.sessionId ||
        !Number.isSafeInteger(session.startedAt) ||
        session.startedAt <= 0
      )
        return null
      if (!lock) return readCurrentAccess()
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
      return readCurrentAccess()

      async function readCurrentAccess() {
        // One statement gives reads a coherent snapshot. Commands already own the ordered locks.
        // Apply the same authorization meaning to both paths; never cache the decision.
        const startedAt = new Date(session.startedAt).toISOString()
        const hash = createHash('sha256').update(session.sessionId).digest('hex')
        const [current] = await tx
          .select({
            identityId: adminIdentities.id,
            grantId: adminAccessGrants.id,
            name: adminIdentities.displayName,
            email: adminIdentities.contactEmail,
          })
          .from(adminExternalIdentities)
          .innerJoin(
            adminIdentities,
            eq(adminIdentities.id, adminExternalIdentities.adminIdentityId),
          )
          .innerJoin(adminAccessGrants, eq(adminAccessGrants.adminIdentityId, adminIdentities.id))
          .where(
            and(
              eq(adminExternalIdentities.provider, 'clerk'),
              eq(adminExternalIdentities.providerUserId, session.subject),
              eq(adminIdentities.lifecycleState, 'active'),
              eq(adminAccessGrants.state, 'active'),
              sql`${adminAccessGrants.effectiveAt} <= clock_timestamp()`,
              sql`${adminAccessGrants.endedAt} is null`,
              sql`${startedAt}::timestamptz <= clock_timestamp()`,
              sql`not exists (select 1 from ${adminAccessStateTransitions}
              where ${adminAccessStateTransitions.grantId} = ${adminAccessGrants.id}
              and ${adminAccessStateTransitions.fromState} = 'suspended'
              and ${adminAccessStateTransitions.toState} = 'active'
              and ${adminAccessStateTransitions.recordedAt} >= ${startedAt}::timestamptz)`,
              sql`not exists (select 1 from ${adminSessions}
              where ${adminSessions.providerSessionHash} = ${hash}
              and (${adminSessions.revokedAt} is not null or ${adminSessions.grantId} <> ${adminAccessGrants.id}))`,
            ),
          )
          .limit(1)
        if (!current) return null
        return {
          actor: {
            kind: 'admin' as const,
            adminIdentityId: current.identityId,
            accessGrantId: current.grantId,
            sessionId: session.sessionId,
          },
          displayName: current.name,
          email: current.email,
        }
      }
    },
  }
}
