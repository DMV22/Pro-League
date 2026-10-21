export type PullRequest = {
  number: number
  repository: string
  headRepository: string
  base: string
  sha: string
  state: 'open' | 'closed'
}

export function planPreview(
  pr: PullRequest,
  files: string[],
  resources: { active: number; existing?: boolean } = { active: 0 },
) {
  if (!Number.isSafeInteger(pr.number) || pr.number < 1 || !/^[a-f0-9]{40}$/.test(pr.sha))
    throw new Error('Invalid PR identity')
  if (
    pr.repository !== 'DMV22/Pro-League' ||
    pr.headRepository !== pr.repository ||
    pr.base !== 'develop'
  )
    return { kind: 'skip', reason: 'untrusted-pr' } as const
  if (pr.state === 'closed') return { kind: 'cleanup' } as const
  if (
    files.every(
      (file) =>
        file.endsWith('.md') ||
        file === 'skills-lock.json' ||
        ['docs/', 'tests/', '.github/', '.agents/', 'scripts/preview/'].some((prefix) =>
          file.startsWith(prefix),
        ),
    )
  )
    return { kind: 'skip', reason: 'non-runtime' } as const
  if (!resources.existing && resources.active >= 2)
    return { kind: 'blocked', reason: 'capacity' } as const
  return { kind: 'prepare' } as const
}
