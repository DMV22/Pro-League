import { uiText } from '@/shared/i18n/ui-text'
import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { getAdminAccess } from '@/server/auth/admin-access'
import { readAdminAuthConfig } from '@/server/auth/config'
import { AdminAccessStatus } from '@/components/admin/access-status'
import { LazyClerkControls } from '@/components/admin/lazy-clerk-controls'
import AdminLoading from './loading'

export default function AdminHomePage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminAccess />
    </Suspense>
  )
}

async function AdminAccess() {
  await connection()
  const access = await getAdminAccess()
  const config = readAdminAuthConfig()
  if (access.status !== 'authorized') {
    return (
      <section className="admin-card" aria-labelledby="admin-title">
        <h1 id="admin-title">{uiText.admin.accessTitle}</h1>
        <p>
          {access.status === 'unavailable'
            ? uiText.admin.unavailable
            : access.status === 'forbidden'
              ? uiText.admin.denied
              : uiText.admin.signInDescription}
        </p>
        {config ? (
          access.status === 'forbidden' ? (
            <LazyClerkControls mode="sign-out" publishableKey={config.publishableKey} />
          ) : (
            <Link href="/admin/sign-in">{uiText.admin.signIn}</Link>
          )
        ) : null}
      </section>
    )
  }
  return (
    <section className="admin-card" aria-labelledby="admin-title">
      <p className="portal-kicker">{uiText.admin.kicker}</p>
      <h1 id="admin-title">{uiText.admin.pageTitle}</h1>
      <p>{access.displayName}</p>
      <p>{uiText.admin.summary}</p>
      <p className="admin-notice">{uiText.admin.authNotice}</p>
      <AdminAccessStatus />
      {config ? <LazyClerkControls mode="sign-out" publishableKey={config.publishableKey} /> : null}
    </section>
  )
}
