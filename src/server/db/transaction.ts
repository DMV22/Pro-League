import { createCompetitionRepository } from '../../modules/competition/infrastructure/repository'
import { createMatchRepository } from '../../modules/match/infrastructure/repository'
import { createRegistrationRepository } from '../../modules/registration/infrastructure/repository'
import { createAuditRepository } from '../../modules/governance/infrastructure/audit-repository'
import type { AuditPolicies } from '../../modules/governance/application/audit-port'
import type { TransactionPort } from '../../application/transaction'
import { mapDatabaseFailure } from './failures'
import type { Database } from './transaction-types'

export function createTransactionAdapter(
  database: Database,
  options: { auditPolicies?: AuditPolicies } = {},
): TransactionPort {
  return {
    async run(command) {
      try {
        return await database.transaction(async (tx) => {
          const audit = createAuditRepository(tx, options.auditPolicies ?? {})
          let auditFailure: unknown
          const result = await command({
            competition: createCompetitionRepository(tx),
            registration: createRegistrationRepository(tx),
            match: createMatchRepository(tx),
            audit: {
              async append(event) {
                try {
                  return await audit.append(event)
                } catch (error) {
                  auditFailure = error
                  throw error
                }
              },
            },
          })
          // Validation can fail without aborting PostgreSQL itself. Never commit a swallowed Audit failure.
          if (auditFailure !== undefined) throw auditFailure
          return result
        })
      } catch (error) {
        throw mapDatabaseFailure(error)
      }
    },
  }
}
