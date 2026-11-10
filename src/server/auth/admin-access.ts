import 'server-only'
import { readAdminAccess } from '../../application/queries/admin-access'
import { createLocalAdminAccess } from '../../modules/identity-access/infrastructure/command-access'
import { getDatabase } from '../db/client'
import { getAdminSession } from './clerk-session'

/** Request-owned, intentionally not React.cache/use cache/global memoized. Safe for JSON/RSC. */
export async function getAdminAccess() {
  const decision = await readAdminAccess({
    session: getAdminSession(),
    access: () => createLocalAdminAccess(getDatabase()),
  })
  if (decision.status !== 'authorized') return decision
  return { status: 'authorized' as const, displayName: decision.displayName }
}
