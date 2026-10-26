import assert from 'node:assert/strict'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const repository = 'DMV22/Pro-League'

export function cloudInputs(pr, sha, run) {
  assert(/^[1-9]\d{0,8}$/.test(pr), 'Invalid PR number')
  assert(/^[a-f0-9]{40}$/.test(sha), 'Invalid candidate SHA')
  assert(/^[1-9]\d{0,15}$/.test(run), 'Invalid controller run')
  return {
    pr: Number(pr),
    sha,
    run,
    origin: `https://pro-league-development-pr-${pr}.onrender.com`,
  }
}

/** GitHub evidence is corroboration, not independent provider/HMAC attestation. */
export function validateCloudTarget(input, pr, run, jobs, artifacts, comparison, deployments) {
  assert(pr.state === 'open' && pr.base.ref === 'develop', 'Pilot is not open against develop')
  assert(pr.head.repo.full_name === repository && pr.base.repo.full_name === repository)
  assert(pr.head.sha === input.sha, 'Pilot changed SHA')
  assert(/^[a-f0-9]{40}$/.test(pr.base.sha), 'Invalid reviewed baseline')
  assert(run.repository.full_name === repository && run.head_sha === input.sha)
  assert(run.path === '.github/workflows/preview-lifecycle.yml')
  assert(['pull_request_target', 'workflow_dispatch'].includes(run.event))
  assert(run.status === 'completed' && run.conclusion === 'success', 'Controller did not pass')
  assert(jobs.some((job) => job.name === 'reconcile' && job.conclusion === 'success'))
  assert(comparison.status === 'ahead' && comparison.files.length === 1, 'Not a marker-only pilot')
  assert(comparison.files[0].filename === 'public/m3-acceptance-pilot.txt')
  assert(comparison.files[0].status === 'added', 'Pilot changed application code')
  const name = `isolated-preview-lighthouse-${input.pr}-${input.run}`
  const matches = artifacts.filter((artifact) => artifact.name === name)
  assert(matches.length === 1 && !matches[0].expired, 'Controller evidence unavailable')
  assert(matches[0].size_in_bytes > 0 && matches[0].size_in_bytes <= 100 * 1024 * 1024)
  assert(
    deployments.some(
      (deployment) =>
        deployment.sha === input.sha && deployment.environment.endsWith(` PR #${input.pr}`),
    ),
    'No matching deployment',
  )
  return { baseline: pr.base.sha, artifact: name, artifactId: matches[0].id }
}

export async function inspectCloudTarget(env = process.env, fetcher = fetch) {
  assert(env.GITHUB_REF === 'refs/heads/main', 'Run reviewed workflow on main only')
  const input = cloudInputs(env.M3_PR, env.M3_SHA, env.M3_CONTROLLER_RUN)
  assert(env.GH_TOKEN, 'Read-only GitHub token required for metadata step')
  const api = async (path) => {
    const response = await fetcher(`https://api.github.com/repos/${repository}/${path}`, {
      headers: { authorization: `Bearer ${env.GH_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
    })
    assert(response.ok, `GitHub metadata request failed (${response.status})`)
    return response.json()
  }
  const pr = await api(`pulls/${input.pr}`)
  const [run, jobs, artifacts, comparison, deployments] = await Promise.all([
    api(`actions/runs/${input.run}`),
    api(`actions/runs/${input.run}/jobs?per_page=100`),
    api(`actions/runs/${input.run}/artifacts?per_page=100`),
    api(`compare/${pr.base.sha}...${input.sha}`),
    api(`deployments?sha=${input.sha}&per_page=100`),
  ])
  const validated = validateCloudTarget(
    input,
    pr,
    run,
    jobs.jobs,
    artifacts.artifacts,
    comparison,
    deployments,
  )
  const deployment = deployments.find(
    (item) => item.sha === input.sha && item.environment.endsWith(` PR #${input.pr}`),
  )
  const statuses = await api(`deployments/${deployment.id}/statuses?per_page=1`)
  assert(
    statuses[0]?.state === 'success' && statuses[0].environment_url === input.origin,
    'Deployment is not successful at the exact Preview origin',
  )
  const evidence = {
    ...input,
    ...validated,
    checkedAt: new Date().toISOString(),
    collectorSha: env.GITHUB_SHA,
    controllerUrl: run.html_url,
    runUrl: `https://github.com/${repository}/actions/runs/${env.GITHUB_RUN_ID}`,
  }
  return evidence
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const evidence = await inspectCloudTarget()
  mkdirSync('artifacts/m3-cloud', { recursive: true })
  const suffix = process.argv.includes('--after') ? 'after' : 'before'
  writeFileSync(`artifacts/m3-cloud/target-${suffix}.json`, JSON.stringify(evidence, null, 2))
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `baseline=${evidence.baseline}\norigin=${evidence.origin}\nartifact=${evidence.artifact}\n`,
    )
}
