'use server'
import { getAdminAccess } from '@/server/auth/admin-access'

/** Refreshes access status only. No mutation and no client-supplied actor or cached allow. */
export async function checkAdminAccessAction() {
  return getAdminAccess()
}
