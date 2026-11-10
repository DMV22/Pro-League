'use client'
import { useActionState } from 'react'
import { checkAdminAccessAction } from '@/app/(admin)/admin/actions'
import { uiText } from '@/shared/i18n/ui-text'

/** A visible status refresh, never a permission cached for later mutations. */
export function AdminAccessStatus() {
  const [access, refresh, pending] = useActionState(async () => checkAdminAccessAction(), null)
  return (
    <form action={refresh}>
      <button type="submit" disabled={pending}>
        {pending ? uiText.admin.checkingAccess : uiText.admin.refreshAccess}
      </button>
      <p role="status" aria-live="polite">
        {access
          ? access.status === 'authorized'
            ? uiText.admin.accessConfirmed
            : access.status === 'unavailable'
              ? uiText.admin.unavailable
              : uiText.admin.denied
          : null}
      </p>
    </form>
  )
}
