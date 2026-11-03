import { and, asc, eq, sql } from 'drizzle-orm'
import type { Database } from '../../../server/db/transaction-types'
import type { OutboxDeliveryPort } from '../application/outbox-delivery-port'
import { outboxMessages } from './schema'
import { outboxFailure } from './outbox-repository'
import {
  exhaustedAttemptCode,
  safeDeliveryProblemCode,
  validateDeliveryResult,
  validateClaimOptions,
  validateProblemLimit,
} from '../application/delivery-policy'

export function createOutboxDelivery(database: Database): OutboxDeliveryPort {
  return {
    async listProblems(limit) {
      validateProblemLimit(limit)
      try {
        const rows = await database
          .select({
            id: outboxMessages.id,
            version: outboxMessages.version,
            state: outboxMessages.state,
            attemptCount: outboxMessages.attemptCount,
            code: outboxMessages.sanitizedOutcome,
          })
          .from(outboxMessages)
          .where(
            sql`${outboxMessages.state} in ('failed', 'exhausted') or
            (${outboxMessages.state} = 'leased' and ${outboxMessages.leaseUntilAt} <= clock_timestamp())`,
          )
          .orderBy(asc(outboxMessages.updatedAt), asc(outboxMessages.id))
          .limit(limit)
        return rows.map((row) => ({
          ...row,
          code: safeDeliveryProblemCode(row.state, row.code),
        }))
      } catch (error) {
        throw outboxFailure(error)
      }
    },
    async claim(options) {
      validateClaimOptions(options)
      try {
        return await database.transaction(async (tx) => {
          await tx.execute(sql`set local statement_timeout = '5s'`)
          const candidates = await tx
            .select()
            .from(outboxMessages)
            .where(
              sql`
            (${outboxMessages.state} = 'pending' and ${outboxMessages.availableAt} <= clock_timestamp()) or
            (${outboxMessages.state} = 'leased' and ${outboxMessages.leaseUntilAt} <= clock_timestamp())
          `,
            )
            .orderBy(asc(outboxMessages.availableAt), asc(outboxMessages.id))
            .limit(options.limit)
            .for('update', { skipLocked: true })
          const leases = []
          let exhaustedCount = 0
          for (const message of candidates) {
            if (message.attemptCount >= options.maxAttempts) {
              await tx
                .update(outboxMessages)
                .set({
                  state: 'exhausted',
                  sanitizedOutcome: exhaustedAttemptCode,
                  leaseUntilAt: null,
                  version: sql`${outboxMessages.version} + 1`,
                  updatedAt: sql`clock_timestamp()`,
                })
                .where(eq(outboxMessages.id, message.id))
              exhaustedCount += 1
              continue
            }
            const [leased] = await tx
              .update(outboxMessages)
              .set({
                state: 'leased',
                version: sql`${outboxMessages.version} + 1`,
                updatedAt: sql`clock_timestamp()`,
                leaseUntilAt: sql`clock_timestamp() + ${options.leaseMs} * interval '1 millisecond'`,
                attemptCount: sql`${outboxMessages.attemptCount} + 1`,
              })
              .where(eq(outboxMessages.id, message.id))
              .returning()
            leases.push({
              id: leased.id,
              version: leased.version,
              attemptCount: leased.attemptCount,
              intent: {
                id: leased.id,
                messageType: leased.messageType,
                schemaVersion: leased.schemaVersion,
                payload: leased.payload,
                aggregateType: leased.aggregateType,
                aggregateId: leased.aggregateId,
                aggregateVersion: leased.aggregateVersion,
                correlationKey: leased.correlationKey,
                causationKey: leased.causationKey,
              },
            })
          }
          return { leases, scannedCount: candidates.length, exhaustedCount }
        })
      } catch (error) {
        throw outboxFailure(error)
      }
    },
    async settle(lease, result) {
      validateDeliveryResult(result)
      try {
        return await database.transaction(async (tx) => {
          await tx.execute(sql`set local statement_timeout = '5s'`)
          // Acquire the row first: UPDATE may evaluate a clock predicate before waiting for its lock.
          // The separate expiry predicate below must run after that wait, not use pre-wait eligibility.
          const locked = await tx
            .select({ id: outboxMessages.id })
            .from(outboxMessages)
            .where(
              and(
                eq(outboxMessages.id, lease.id),
                eq(outboxMessages.version, lease.version),
                eq(outboxMessages.state, 'leased'),
              ),
            )
            .for('update')
          if (!locked.length) return false
          const rows = await tx
            .update(outboxMessages)
            .set({
              state: result.status === 'retry' ? 'pending' : result.status,
              sanitizedOutcome: result.code,
              leaseUntilAt: null,
              updatedAt: sql`clock_timestamp()`,
              ...(result.status === 'retry'
                ? {
                    availableAt: sql`clock_timestamp() + ${result.delayMs} * interval '1 millisecond'`,
                  }
                : {}),
              version: sql`${outboxMessages.version} + 1`,
            })
            .where(
              and(
                eq(outboxMessages.id, lease.id),
                eq(outboxMessages.version, lease.version),
                eq(outboxMessages.state, 'leased'),
                sql`${outboxMessages.leaseUntilAt} > clock_timestamp()`,
              ),
            )
            .returning({ id: outboxMessages.id })
          return rows.length === 1
        })
      } catch (error) {
        throw outboxFailure(error)
      }
    },
  }
}
