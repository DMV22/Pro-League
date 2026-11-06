import type { CompetitionRepository } from '../modules/competition/application/repository'
import type { RegistrationRepository } from '../modules/registration/application/repository'
import type { MatchRepository } from '../modules/match/application/repository'
import type { AuditPort } from '../modules/governance/application/audit-port'
import type { OutboxPort } from '../modules/operations/application/outbox-port'
import type { CommandAccessPort } from '../modules/identity-access/application/command-access-port'
import type { CommandExecutionPort } from '../modules/operations/application/command-execution-port'

export interface TransactionRepositories {
  competition: CompetitionRepository
  registration: RegistrationRepository
  match: MatchRepository
  audit: AuditPort
  outbox: OutboxPort
  commandAccess: CommandAccessPort
  commandExecutions: CommandExecutionPort
}

export interface TransactionPort {
  run<T>(
    command: (repositories: TransactionRepositories) => Promise<T>,
    options?: Readonly<{ bounded: true }>,
  ): Promise<T>
}
