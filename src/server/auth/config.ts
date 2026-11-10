import 'server-only'

/** Explicit opt-in. Invalid or partial configuration never opens Admin. */
export function readAdminAuthConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Readonly<{
  publishableKey: string
  secretKey: string
  origins: string[]
}> | null {
  if (env.ADMIN_AUTH_ENABLED !== 'true') return null
  const publishableKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()
  const secretKey = env.CLERK_SECRET_KEY?.trim()
  if (
    !publishableKey ||
    !/^pk_(test|live)_/.test(publishableKey) ||
    !secretKey ||
    !/^sk_(test|live)_/.test(secretKey)
  )
    return null
  if (publishableKey.split('_')[1] !== secretKey.split('_')[1]) return null
  const origins = env.ADMIN_AUTH_ORIGINS?.split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  if (!origins?.length) return null
  try {
    for (const origin of origins) {
      const url = new URL(origin)
      if (
        url.hostname.includes('*') ||
        url.origin !== origin ||
        url.username ||
        url.password ||
        (url.protocol !== 'https:' &&
          !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
      )
        return null
    }
  } catch {
    return null
  }
  return { publishableKey, secretKey, origins: [...new Set(origins)] }
}
