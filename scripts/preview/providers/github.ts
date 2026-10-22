import { absent, type JsonClient } from '../http'
import type { PullRequest } from '../policy'
import type { PreviewRecord } from '../reconcile'
import { stateMarker, type StateCodec } from '../state'
import { createHash } from 'node:crypto'

const repository = '/repos/DMV22/Pro-League'
export class AllocationBlockedError extends Error {
  constructor() {
    super('Resolve cleanup alerts before allocating new Previews')
  }
}
type PrResponse = {
  number: number
  state: 'open' | 'closed'
  changed_files: number
  head: { sha: string; ref: string; repo: { full_name: string } | null }
  base: { ref: string; repo: { full_name: string } }
}
type Comment = { id: number; body: string; user: { login: string; type: string } }

export function createGitHub(client: JsonClient, codec: StateCodec) {
  async function pages<T>(path: string): Promise<T[]> {
    const rows: T[] = []
    for (let page = 1; page <= 100; page++) {
      const next = await client.get<T[]>(
        `${repository}${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`,
      )
      rows.push(...next)
      if (next.length < 100) return rows
    }
    throw new Error('GitHub pagination limit reached')
  }
  async function raw(pr: number) {
    if (!Number.isSafeInteger(pr) || pr < 1) throw new Error('Invalid PR number')
    return client.get<PrResponse>(`${repository}/pulls/${pr}`)
  }
  async function recordComment(pr: number) {
    const comments = (await pages<Comment>(`/issues/${pr}/comments`)).filter(
      (comment) =>
        comment.user.login === 'github-actions[bot]' &&
        comment.user.type === 'Bot' &&
        comment.body.startsWith(stateMarker),
    )
    if (comments.length > 1)
      throw new Error('Duplicate ownership records; operator review required')
    if (comments[0]) codec.decode(comments[0].body, pr)
    return comments[0]
  }
  return {
    raw,
    async baseline(pr: PullRequest) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const result = await client.get<{
          workflow_runs: {
            head_sha: string
            status: string
            conclusion: string | null
            head_repository: { full_name: string } | null
            pull_requests: { number: number }[]
          }[]
        }>(
          `${repository}/actions/workflows/pr-baseline.yml/runs?event=pull_request&head_sha=${pr.sha}&per_page=100`,
        )
        const run = result.workflow_runs.find(
          (run) =>
            run.head_sha === pr.sha &&
            run.head_repository?.full_name === pr.headRepository &&
            run.pull_requests.some((item) => item.number === pr.number),
        )
        if (run?.status === 'completed') {
          if (run.conclusion !== 'success') throw new Error('Baseline CI failed')
          return
        }
        const current = await raw(pr.number)
        if (current.state !== 'open' || current.head.sha !== pr.sha)
          throw new Error('PR changed while waiting for baseline CI')
        await new Promise((resolve) => setTimeout(resolve, 15_000))
      }
      throw new Error('Baseline CI not ready; retry the trusted controller after CI completes')
    },
    async assertEnvironment(name: 'preview-control' | 'preview-migrations', review: boolean) {
      const environment = await client.get<{
        protection_rules: { type: string; reviewers?: unknown[] }[]
        deployment_branch_policy: { custom_branch_policies: boolean } | null
      }>(`${repository}/environments/${name}`)
      if (
        review &&
        !environment.protection_rules.some(
          (rule) => rule.type === 'required_reviewers' && rule.reviewers?.length,
        )
      )
        throw new Error('Migration environment needs a required reviewer')
      if (!environment.deployment_branch_policy?.custom_branch_policies)
        throw new Error('Preview environment must restrict trusted deployment branches')
      const policies = await client.get<{
        branch_policies: { name: string; type: string }[]
        total_count: number
      }>(`${repository}/environments/${name}/deployment-branch-policies`)
      if (
        policies.total_count !== 1 ||
        policies.branch_policies.length !== 1 ||
        policies.branch_policies[0].name !== 'main' ||
        policies.branch_policies[0].type !== 'branch'
      )
        throw new Error('Preview environment permits an untrusted ref')
    },
    async pullRequests() {
      return (await pages<PrResponse>('/pulls?state=all&base=develop')).map((pr) => pr.number)
    },
    async current(number: number): Promise<PullRequest> {
      const pr = await raw(number)
      return {
        number: pr.number,
        repository: pr.base.repo.full_name,
        headRepository: pr.head.repo?.full_name ?? '',
        base: pr.base.ref,
        sha: pr.head.sha,
        state: pr.state,
      }
    },
    async files(pr: PullRequest) {
      const current = await raw(pr.number)
      if (current.head.sha !== pr.sha || current.changed_files > 3000)
        throw new Error('PR diff is obsolete or too large')
      const files = await pages<{ filename: string; previous_filename?: string }>(
        `/pulls/${pr.number}/files`,
      )
      if (files.length !== current.changed_files) throw new Error('Incomplete PR diff')
      return files.flatMap((file) =>
        file.previous_filename ? [file.filename, file.previous_filename] : [file.filename],
      )
    },
    async record(number: number) {
      const comment = await recordComment(number)
      return comment ? codec.decode(comment.body, number) : undefined
    },
    async save(record: PreviewRecord) {
      const comment = await recordComment(record.pr)
      const body = codec.encode(record)
      if (comment) await client.patch(`${repository}/issues/comments/${comment.id}`, { body })
      else await client.post(`${repository}/issues/${record.pr}/comments`, { body })
    },
    async label(pr: number, enabled: boolean) {
      if (enabled)
        await client.post(`${repository}/issues/${pr}/labels`, { labels: ['render-preview'] })
      else
        try {
          await client.delete(`${repository}/issues/${pr}/labels/render-preview`)
        } catch (error) {
          if (!absent(error)) throw error
        }
    },
    async status(pr: PullRequest, state: 'pending' | 'success' | 'failure', description: string) {
      await client.post(`${repository}/statuses/${pr.sha}`, {
        state,
        context: 'isolated-preview',
        description,
      })
    },
    async alert(pr: PullRequest) {
      const marker = `<!-- preview-cleanup-failure:${pr.number} -->`
      const issues = await pages<{ body: string }>(
        `/issues?state=open&creator=github-actions%5Bbot%5D`,
      )
      if (!issues.some((issue) => issue.body?.startsWith(marker)))
        await client.post(`${repository}/issues`, {
          title: `Preview cleanup requires operator action: PR #${pr.number}`,
          body: `${marker}\nCleanup of PR #${pr.number} is incomplete. Inspect its signed ownership record and the Actions run. Verify the PR is closed or its signed reservation has expired, and resource identities match before removal. Do not delete unknown resources or the empty parent. New allocations must remain blocked until the alert is resolved.`,
        })
    },
    async assertAllocationAllowed() {
      const issues = await pages<{ body: string }>(
        `/issues?state=open&creator=github-actions%5Bbot%5D`,
      )
      if (
        issues.some(
          (issue) =>
            issue.body?.startsWith('<!-- preview-cleanup-failure:') ||
            issue.body?.startsWith('<!-- preview-inventory-failure -->'),
        )
      )
        throw new AllocationBlockedError()
    },
    async alertInventory() {
      const marker = '<!-- preview-inventory-failure -->'
      const issues = await pages<{ body: string }>(
        `/issues?state=open&creator=github-actions%5Bbot%5D`,
      )
      if (!issues.some((issue) => issue.body?.startsWith(marker)))
        await client.post(`${repository}/issues`, {
          title: 'Unknown Preview resources require operator review',
          body: `${marker}\nThe pinned Neon project or Render base service contains resources without a matching signed PR ownership record. Inspect both provider inventories and the Actions run. Do not delete or adopt unknown resources automatically. Resolve the mismatch before closing this alert; new allocations remain blocked.`,
        })
    },
    async authorise(pr: PullRequest) {
      const { head } = await raw(pr.number)
      if (head.sha !== pr.sha) throw new Error('PR changed')
      return head.ref
    },
    async migrationFiles(sha: string) {
      if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid commit')
      const tree = await client.get<{
        truncated: boolean
        tree: { path: string; mode: string; type: string; sha: string; size?: number }[]
      }>(`${repository}/git/trees/${sha}?recursive=1`)
      if (tree.truncated) throw new Error('Cannot verify a truncated Git tree')
      const files = tree.tree.filter(
        (entry) => entry.path.startsWith('drizzle/') && entry.type !== 'tree',
      )
      if (files.length === 0 || files.length > 260)
        throw new Error('Unexpected migration inventory')
      const result: Record<string, string> = {}
      let total = 0
      for (const file of files) {
        if (
          file.mode !== '100644' ||
          !/^drizzle\/(?:\d{4}_[a-z0-9_]+\.sql|meta\/(?:_journal|\d{4}_snapshot)\.json)$/.test(
            file.path,
          ) ||
          !file.size ||
          file.size > 2 * 1024 * 1024
        )
          throw new Error('Unsafe migration file')
        total += file.size
        if (total > 16 * 1024 * 1024) throw new Error('Migration bundle too large')
        const blob = await client.get<{
          encoding: string
          content: string
          size: number
          sha: string
        }>(`${repository}/git/blobs/${file.sha}`)
        if (blob.encoding !== 'base64' || blob.sha !== file.sha || blob.size !== file.size)
          throw new Error('Invalid migration blob')
        const bytes = Buffer.from(blob.content, 'base64')
        if (bytes.length !== file.size) throw new Error('Migration blob size differs')
        if (
          createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !==
          file.sha
        )
          throw new Error('Migration Git object hash differs')
        result[file.path] = bytes.toString('utf8')
      }
      return result
    },
  }
}

export type GitHub = ReturnType<typeof createGitHub>
