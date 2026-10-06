import type { CompetitionRepository } from '../modules/competition/application/repository'
import type { RegistrationRepository } from '../modules/registration/application/repository'
import type { MatchRepository } from '../modules/match/application/repository'

export interface TransactionRepositories {
  competition: CompetitionRepository
  registration: RegistrationRepository
  match: MatchRepository
}

export interface TransactionPort {
  run<T>(command: (repositories: TransactionRepositories) => Promise<T>): Promise<T>
}
