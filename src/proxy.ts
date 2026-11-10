import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server'
import { readAdminAuthConfig } from './server/auth/config'

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const config = readAdminAuthConfig()
  if (!config) return NextResponse.next()
  // Public routes are outside this matcher. Proxy only establishes verified Clerk context.
  // Every private entry point independently checks both session and local access.
  return clerkMiddleware({
    secretKey: config.secretKey,
    publishableKey: config.publishableKey,
    authorizedParties: config.origins,
    signInUrl: '/admin/sign-in',
  })(request, event)
}

export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] }
