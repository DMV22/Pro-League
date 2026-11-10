'use client'

import { ClerkProvider, SignIn, SignOutButton } from '@clerk/nextjs'
import { uiText } from '@/shared/i18n/ui-text'

export default function ClerkControls({
  publishableKey,
  mode,
}: {
  publishableKey: string
  mode: 'sign-in' | 'sign-out'
}) {
  return (
    <ClerkProvider publishableKey={publishableKey} signInUrl="/admin/sign-in">
      {mode === 'sign-in' ? (
        <SignIn routing="path" path="/admin/sign-in" forceRedirectUrl="/admin" withSignUp={false} />
      ) : (
        <SignOutButton redirectUrl="/admin/sign-in">
          <button type="button">{uiText.admin.signOut}</button>
        </SignOutButton>
      )}
    </ClerkProvider>
  )
}
