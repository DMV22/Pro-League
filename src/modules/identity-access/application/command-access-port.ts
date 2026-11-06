import type { AdminActor } from '../../../shared/application/command-context'

/** Only a trusted authentication adapter may supply this completed, verified session. */
export type VerifiedAdminSession = Readonly<{ subject: string; sessionId: string }>
export interface AdminSessionPort {
  verify(): Promise<VerifiedAdminSession | null>
}
export interface CommandAccessPort {
  /** Locks current local identity/mapping/grant through commit; never trusts client actor IDs. */
  authorize(session: VerifiedAdminSession): Promise<Readonly<{
    actor: AdminActor
    displayName: string
    email: string
  }> | null>
}
