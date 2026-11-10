import { Suspense } from 'react'
import { connection } from 'next/server'
import { readAdminAuthConfig } from '@/server/auth/config'
import { uiText } from '@/shared/i18n/ui-text'
import { LazyClerkControls } from '@/components/admin/lazy-clerk-controls'
import AdminLoading from '../../loading'

export default function SignInPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminSignIn />
    </Suspense>
  )
}

async function AdminSignIn() {
  await connection()
  const config = readAdminAuthConfig()
  return (
    <section className="admin-card" aria-labelledby="sign-in-title">
      <h1 id="sign-in-title">{uiText.admin.accessTitle}</h1>
      <p>{config ? uiText.admin.signInDescription : uiText.admin.unavailable}</p>
      {config ? <LazyClerkControls mode="sign-in" publishableKey={config.publishableKey} /> : null}
    </section>
  )
}
