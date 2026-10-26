// Compiled by `pnpm types`, not executed as a runtime test.
import type {
  AdminActor,
  CommandContext,
  SystemActor,
} from '../../shared/application/command-context'
import type { ExpectedVersion } from '../../shared/application/persistence'
import type {
  AuthorizationDecision,
  CommandExecutionIdentity,
  CommandOutcome,
  ProtectedAdminCommand,
} from './contracts'
import type { CommandEnvelope } from './envelope'

type Assert<T extends true> = T
type Assignable<From, To> = [From] extends [To] ? true : false
type MissingGrant = { kind: 'admin'; adminIdentityId: string }
type BrowserActor = { idempotencyKey: string; payload: unknown; actor: SystemActor }
type VersionAsString = { id: string; expectedVersion: string }
type UnknownFailure = { status: 'unavailable'; code: 'raw_sql_error' }
type WrongSuccess = { status: 'succeeded'; value: number }
type EnvelopeVersion = NonNullable<CommandEnvelope['expectedVersion']>

export type ValidContracts = [
  Assert<Assignable<NonNullable<CommandEnvelope['expectedVersion']>, Readonly<ExpectedVersion>>>,
  Assert<
    Assignable<{ status: 'succeeded'; value: { id: string } }, CommandOutcome<{ id: string }>>
  >,
  Assert<Assignable<{ status: 'authorized'; actor: AdminActor }, AuthorizationDecision>>,
  Assert<
    Assignable<
      Parameters<ProtectedAdminCommand<{ title: string }, string>>[1],
      CommandContext<AdminActor>
    >
  >,
  Assert<Assignable<CommandExecutionIdentity['idempotencyKey'], CommandEnvelope['idempotencyKey']>>,
]

// @ts-expect-error A browser envelope is not a trusted server context.
export type UntrustedContext = Assert<Assignable<CommandEnvelope, CommandContext<AdminActor>>>
// @ts-expect-error A System actor must not impersonate an Admin actor.
export type SystemIsNotAdmin = Assert<Assignable<SystemActor, AdminActor>>
// @ts-expect-error An Admin actor requires both local identity and grant plus session context.
export type IncompleteActor = Assert<Assignable<MissingGrant, AdminActor>>
// @ts-expect-error Injected actor is rejected even when an object is passed through a variable.
export type InjectedActor = Assert<Assignable<BrowserActor, CommandEnvelope>>
// @ts-expect-error Transport strings are not internal bigint versions.
export type LossyVersion = Assert<Assignable<VersionAsString, EnvelopeVersion>>
// @ts-expect-error Unknown SQL/provider error codes are not public command outcomes.
export type LeakedFailure = Assert<Assignable<UnknownFailure, CommandOutcome<never>>>
// @ts-expect-error A failed outcome cannot masquerade as a success payload.
export type FailedSuccess = Assert<Assignable<WrongSuccess, CommandOutcome<string>>>

export function exhaustiveOutcome(result: CommandOutcome<string>): string {
  switch (result.status) {
    case 'succeeded':
      return result.value
    case 'unauthenticated':
      return 'sign_in'
    case 'forbidden':
      return result.code
    case 'invalid':
      return result.issues[0]?.code ?? 'invalid'
    case 'conflict':
      return result.code
    case 'unavailable':
      return result.code
    default: {
      const unreachable: never = result
      return unreachable
    }
  }
}
