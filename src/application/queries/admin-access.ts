import type {
  AdminAccessPort,
  AdminSessionPort,
} from '../../modules/identity-access/application/command-access-port'
import type { CommandAccessFailure } from '../commands/contracts'
import type { AdminActor } from '../../shared/application/command-context'

export type AdminReadAccess =
  CommandAccessFailure | Readonly<{ status: 'authorized'; actor: AdminActor; displayName: string }>

/** A request-time read decision, not a reusable capability for later commands. */
export async function readAdminAccess(dependencies: {
  session: AdminSessionPort
  access: () => AdminAccessPort
}): Promise<AdminReadAccess> {
  try {
    const session = await dependencies.session.verify()
    if (!session) return { status: 'unauthenticated' }
    const current = await dependencies.access().authorize(session)
    if (!current) return { status: 'forbidden', code: 'access_denied' }
    return { status: 'authorized', actor: current.actor, displayName: current.displayName }
  } catch {
    return { status: 'unavailable', code: 'authorization_unavailable' }
  }
}
