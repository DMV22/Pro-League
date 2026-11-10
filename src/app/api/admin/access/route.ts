import { getAdminAccess } from '@/server/auth/admin-access'

export async function GET() {
  const access = await getAdminAccess()
  const status =
    access.status === 'authorized'
      ? 200
      : access.status === 'unauthenticated'
        ? 401
        : access.status === 'forbidden'
          ? 403
          : 503
  return Response.json(access, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie, Authorization',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
