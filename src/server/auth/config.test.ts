import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { readAdminAuthConfig } from './config'

it('keeps Admin closed without explicit complete trusted configuration', () => {
  expect(readAdminAuthConfig({})).toBeNull()
  expect(readAdminAuthConfig({ ADMIN_AUTH_ENABLED: 'true' })).toBeNull()
  expect(
    readAdminAuthConfig({ ADMIN_AUTH_ENABLED: 'false', CLERK_SECRET_KEY: 'sk_test_synthetic' }),
  ).toBeNull()
})

const trusted = {
  ADMIN_AUTH_ENABLED: 'true',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_synthetic',
  CLERK_SECRET_KEY: 'sk_test_synthetic',
  ADMIN_AUTH_ORIGINS: 'http://localhost:3000,https://trusted.example.invalid',
}

it('accepts explicit exact origins and rejects wildcard, credential-bearing and mixed-mode configuration', () => {
  expect(readAdminAuthConfig(trusted)?.origins).toEqual([
    'http://localhost:3000',
    'https://trusted.example.invalid',
  ])
  for (const origin of [
    'https://*.example.invalid',
    'http://remote.example.invalid',
    'https://user:pass@example.invalid',
    'https://example.invalid/path',
    'null',
  ])
    expect(readAdminAuthConfig({ ...trusted, ADMIN_AUTH_ORIGINS: origin })).toBeNull()
  expect(readAdminAuthConfig({ ...trusted, CLERK_SECRET_KEY: 'sk_live_synthetic' })).toBeNull()
})
