import { createCompetitionRepository } from '../../modules/competition/infrastructure/repository'
import { createMatchRepository } from '../../modules/match/infrastructure/repository'
import { createRegistrationRepository } from '../../modules/registration/infrastructure/repository'
import type { TransactionPort } from '../../application/transaction'
import { mapDatabaseFailure } from './failures'
import type { Database } from './transaction-types'

export function createTransactionAdapter(database: Database): TransactionPort {
  return {
    async run(command) {
      try {
        return await database.transaction(async (tx) =>
          command({
            competition: createCompetitionRepository(tx),
            registration: createRegistrationRepository(tx),
            match: createMatchRepository(tx),
          }),
        )
      } catch (error) {
        throw mapDatabaseFailure(error)
      }
    },
  }
}
