import { describe, expect, it } from 'vitest'
import {
  assertPreviewRuntime,
  readPreviewIdentity,
  assertPreviewDatabaseUrl,
} from './preview-target'

const identity = {
  projectId: 'long-sea-15202409',
  parentBranchId: 'br-divine-leaf-b90tlpj2',
  branchId: 'br-example-child',
  endpointId: 'ep-example-child',
  directHost: 'ep-example-child.c-7.eu-central-1.aws.neon.tech',
  pullRequest: 105,
  database: 'proleague_golden_seed_pr_105',
}
const url =
  'postgresql://preview_reader_pr_105:private@ep-example-child-pooler.c-7.eu-central-1.aws.neon.tech/proleague_golden_seed_pr_105?sslmode=verify-full'
const environment = {
  IS_PULL_REQUEST: 'true',
  RENDER_EXTERNAL_HOSTNAME: 'pro-league-development-pr-105.onrender.com',
  RENDER_EXTERNAL_URL: 'https://pro-league-development-pr-105.onrender.com',
  PREVIEW_DATABASE_IDENTITY: JSON.stringify(identity),
}

describe('isolated Preview database configuration', () => {
  it('accepts a PR-specific pooled read-only connection without changing local configuration', () => {
    expect(() => assertPreviewRuntime(url, environment)).not.toThrow()
    expect(() =>
      assertPreviewRuntime('postgresql://local:private@localhost/proleague', {}),
    ).not.toThrow()
  })

  it.each([
    { PREVIEW_DATABASE_IDENTITY: undefined },
    { IS_PULL_REQUEST: 'false' },
    { RENDER_EXTERNAL_HOSTNAME: 'pro-league-development-pr-106.onrender.com' },
    { PREVIEW_DATABASE_IDENTITY: JSON.stringify({ ...identity, projectId: 'another-project' }) },
    {
      PREVIEW_DATABASE_IDENTITY: JSON.stringify({ ...identity, branchId: identity.parentBranchId }),
    },
  ])('fails closed for missing or mismatched Preview identity', (override) => {
    expect(() => assertPreviewRuntime(url, { ...environment, ...override })).toThrow(
      'Preview database configuration',
    )
  })

  it.each([
    undefined,
    url.replace('ep-example-child-pooler', 'ep-another-project-pooler'),
    url.replace('proleague_golden_seed_pr_105', 'proleague'),
    url.replace('preview_reader_pr_105', 'neondb_owner'),
    url.replace('sslmode=verify-full', 'sslmode=require'),
    `${url}&host=production.example`,
    `${url}&options=-csearch_path%3Dpublic`,
    `${url}&sslmode=disable`,
  ])('rejects an unsafe URL without revealing its credentials', (candidate) => {
    expect(() => assertPreviewRuntime(candidate, environment)).toThrow(
      'Preview database configuration',
    )
    try {
      assertPreviewRuntime(candidate, environment)
    } catch (error) {
      expect(String(error)).not.toContain('private')
    }
  })

  it('requires a separate direct operations connection', () => {
    const target = readPreviewIdentity(JSON.stringify(identity))
    expect(() => assertPreviewDatabaseUrl(url, target, 'operations')).toThrow()
    expect(() =>
      assertPreviewDatabaseUrl(
        url
          .replace('preview_reader_pr_105', 'preview_owner')
          .replace('ep-example-child-pooler', 'ep-example-child'),
        target,
        'operations',
      ),
    ).not.toThrow()
  })
})
