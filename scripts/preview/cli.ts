import { appendFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { createJsonClient } from './http'
import { createStateCodec } from './state'
import { AllocationBlockedError, createGitHub } from './providers/github'
import { acceptanceMode, recreationExpiry, withAcceptanceFailure } from './acceptance'
import { createNeon } from './providers/neon'
import { createRender } from './providers/render'
import { assertCurrent, cleanupPreview, reconcilePreview, type PreviewSystems } from './reconcile'
import { planPreview } from './policy'
import { bundleDigest, withMigrationBundle } from './migrations'
import { prepareDatabase, readerUrl, verifyReader, withAllocationLease } from './database'

const require = createRequire(import.meta.url)
const toolRoot = fileURLToPath(new URL('.', import.meta.url))
const baseline = JSON.parse(
  readFileSync(new URL('./approved-migrations.json', import.meta.url), 'utf8'),
).bundleHash as string
let reportFailure: (() => Promise<void>) | undefined
const secret = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error('Required Preview control configuration missing')
  return value
}
function safeProcess(script: string, args: string[], extra: Record<string, string>) {
  const env: NodeJS.ProcessEnv = { NODE_ENV: 'production' }
  for (const key of [
    'PATH',
    'Path',
    'SystemRoot',
    'TEMP',
    'TMP',
    'TMPDIR',
    'CI',
    'PLAYWRIGHT_BROWSERS_PATH',
    'CHROME_PATH',
  ]) {
    if (process.env[key]) env[key] = process.env[key]!
  }
  Object.assign(env, extra)
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: toolRoot,
      env,
      stdio: 'inherit',
      windowsHide: true,
    })
    child.once('error', () => reject(new Error('Preview verification process failed')))
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Preview verification failed')),
    )
  })
}

async function main() {
  const [command, number] = process.argv.slice(2)
  const workflow = command === 'sweep' ? 'preview-reconcile.yml' : 'preview-lifecycle.yml'
  if (
    process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.GITHUB_REPOSITORY !== 'DMV22/Pro-League' ||
    process.env.GITHUB_WORKFLOW_REF !==
      `DMV22/Pro-League/.github/workflows/${workflow}@refs/heads/main` ||
    !/^[a-f0-9]{40}$/.test(process.env.GITHUB_WORKFLOW_SHA ?? '') ||
    !['pull_request_target', 'workflow_dispatch', 'schedule'].includes(
      process.env.GITHUB_EVENT_NAME ?? '',
    )
  )
    throw new Error('Preview control runs only from the trusted main workflow')
  if (
    ![
      'inspect',
      'review',
      'run',
      'sweep',
      'recreate',
      'recreate-short-ttl',
      'test-cleanup-failure',
      'test-allocation-block',
    ].includes(command)
  )
    throw new Error('Unknown Preview operation')
  const codec = createStateCodec(secret('PREVIEW_STATE_KEY'))
  const github = createGitHub(createJsonClient('https://api.github.com', secret('GH_TOKEN')), codec)
  await github.assertEnvironment(
    command === 'review' ? 'preview-migrations' : 'preview-control',
    command === 'review',
  )
  const output = (key: string, value: string) => {
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`)
  }
  const prNumber = Number(number)
  if (command !== 'sweep' && (!Number.isSafeInteger(prNumber) || prNumber < 1))
    throw new Error('Invalid PR number')
  const pr = command === 'sweep' ? undefined : await github.current(prNumber)
  if (
    pr?.repository === 'DMV22/Pro-League' &&
    pr.headRepository === pr.repository &&
    pr.base === 'develop'
  )
    reportFailure = () =>
      github.status(pr, 'failure', 'Preview controller failed; inspect the trusted Actions run')
  if (pr && process.env.EXPECTED_PR_SHA && pr.sha !== process.env.EXPECTED_PR_SHA)
    throw new Error('PR changed')
  const requested = command === 'inspect' ? (process.env.PREVIEW_OPERATION ?? 'run') : command
  const acceptance =
    pr &&
    ['recreate-short-ttl', 'test-cleanup-failure', 'test-allocation-block'].includes(requested)
      ? acceptanceMode(requested, pr, await github.authorise(pr), process.env, new Date())
      : undefined
  if (acceptance === 'test-allocation-block') reportFailure = undefined
  if (pr && command === 'inspect') {
    if (acceptance === 'test-cleanup-failure' || acceptance === 'test-allocation-block') {
      output('action', 'acceptance')
      output('sha', pr.sha)
      output('pr', String(pr.number))
      output('review', 'false')
      return // These modes cannot migrate, allocate, bind or run PR code.
    }
    const plan = planPreview(pr, await github.files(pr))
    output(
      'action',
      plan.kind === 'prepare' ? 'prepare' : plan.kind === 'cleanup' ? 'cleanup' : 'skip',
    )
    output('sha', pr.sha)
    output('pr', String(pr.number))
    output('review', 'false')
    if (plan.kind !== 'prepare') {
      if (plan.kind === 'skip')
        await github.status(pr, 'success', 'No eligible runtime Preview required')
      return
    }
    await github.status(pr, 'pending', 'Isolated Preview preparation pending')
    await github.baseline(pr)
    const files = await github.migrationFiles(pr.sha)
    const hash = await withMigrationBundle(files, async () => bundleDigest(files))
    const record = await github.record(pr.number)
    output('manifest', hash)
    output('review', String(hash !== baseline && hash !== record?.migrationHash))
    console.info(`Preview PR #${pr.number}; SHA ${pr.sha}; migration bundle ${hash}`)
    return
  }
  if (pr && command === 'review') {
    const files = await github.migrationFiles(pr.sha)
    await withMigrationBundle(files, async () => {
      if (bundleDigest(files) !== process.env.APPROVED_MIGRATION_HASH)
        throw new Error('Approved migration bundle changed')
    })
    await assertCurrent(pr, github)
    console.info(`Approved exact migration bundle for PR #${pr.number}, SHA ${pr.sha}`)
    return
  }
  if (acceptance === 'test-allocation-block') {
    // Read-only probe of the exact admission guard used below; no provider credentials needed.
    try {
      await github.assertAllocationAllowed()
    } catch (error) {
      if (!(error instanceof AllocationBlockedError)) throw error
      console.info('Acceptance pilot #112: allocation blocked by an open cleanup/inventory alert')
      return
    }
    throw new Error('Acceptance expected an open cleanup alert')
  }
  const neon = createNeon(
    createJsonClient('https://console.neon.tech/api/v2', secret('NEON_API_KEY')),
    codec,
  )
  const render = createRender(
    createJsonClient('https://api.render.com/v1', secret('RENDER_API_KEY')),
    {
      baseServiceId: secret('RENDER_BASE_SERVICE_ID'),
      ownerId: secret('RENDER_OWNER_ID'),
    },
  )
  if (
    !/^srv-[a-z0-9]+$/.test(secret('RENDER_BASE_SERVICE_ID')) ||
    !/^tea-[a-z0-9]+$/.test(secret('RENDER_OWNER_ID'))
  )
    throw new Error('Invalid pinned Render control identity')
  const systems: PreviewSystems = {
    ...github,
    now: () => new Date(),
    async database(current, record) {
      await github.baseline(current)
      await github.assertAllocationAllowed()
      await render.base()
      return withAllocationLease(await neon.parentUrl(), async () => {
        await assertCurrent(current, github)
        return neon.ensure(record)
      })
    },
    async prepare(current, record) {
      const files = await github.migrationFiles(current.sha)
      const hash = bundleDigest(files)
      if (
        hash !== baseline &&
        hash !== record.migrationHash &&
        (process.env.APPROVED_MIGRATION_HASH !== hash ||
          process.env.EXPECTED_PR_SHA !== current.sha)
      )
        throw new Error('New migration bundle needs exact-revision operator approval')
      await assertCurrent(current, github)
      const identity = record.identity!
      const ownerUrl = await neon.connection(identity, record)
      await withMigrationBundle(files, (root) =>
        prepareDatabase(identity, ownerUrl, root, codec.readerPassword(identity)),
      )
      record.migrationHash = hash
    },
    async bind(current, record) {
      await assertCurrent(current, github)
      await github.label(current.number, true)
      const branch = await github.authorise(current)
      const service = record.serviceId
        ? await render.service(record.serviceId, current.number, branch)
        : await render.waitForService(current.number, branch)
      record.serviceId = service.id
      await github.save(record)
      await assertCurrent(current, github)
      await neon.verify(record.identity!, record)
      return render.bindAndDeploy(
        service.id,
        branch,
        record.identity!,
        readerUrl(record.identity!, codec.readerPassword(record.identity!)),
        current.sha,
      )
    },
    async verify(current, record) {
      const branch = await github.authorise(current)
      await render.live(record.serviceId!, record.deployId!, current.number, branch, current.sha)
      await neon.verify(record.identity!, record)
      await verifyReader(
        record.identity!,
        readerUrl(record.identity!, codec.readerPassword(record.identity!)),
      )
      const origin = `https://pro-league-development-pr-${current.number}.onrender.com`
      await safeProcess(
        '--import',
        ['tsx', fileURLToPath(new URL('./smoke.ts', import.meta.url))],
        { PREVIEW_ORIGIN: origin, PREVIEW_PR: String(current.number) },
      )
      const config = fileURLToPath(new URL('../../lighthouserc.cjs', import.meta.url))
      console.log(
        'Temporary #96 waiver: cloud Performance/LCP/TBT are diagnostic for provisional UI',
      )
      await safeProcess(
        require.resolve('@lhci/cli/src/cli.js'),
        ['autorun', `--config=${config}`],
        { LHCI_BASE_URL: origin, LHCI_PREVIEW_PERFORMANCE: 'diagnostic' },
      )
      await render.live(record.serviceId!, record.deployId!, current.number, branch, current.sha)
    },
    async remove(current, record) {
      const branch = await github.authorise(current)
      const service = record.serviceId
        ? await render.service(record.serviceId, current.number, branch).catch((error) => {
            if (error && typeof error === 'object' && 'status' in error && error.status === 404)
              return undefined
            throw error
          })
        : await render.find(current.number, branch)
      await assertCurrent(current, github)
      if (service) await render.remove(service.id, current.number, branch)
      await assertCurrent(current, github)
      await github.label(current.number, false)
      await neon.remove(record, () => assertCurrent(current, github))
    },
  }
  if (command === 'sweep') {
    const failures: number[] = []
    const known = new Set<string>()
    const knownServices = new Set<string>()
    for (const n of await github.pullRequests()) {
      const current = await github.current(n)
      try {
        const record = await github.record(n)
        if (!record || record.phase === 'cleaned') continue
        const branch = await neon.owned(record)
        if (branch) known.add(branch.id)
        if (record.serviceId) knownServices.add(record.serviceId)
        else {
          const service = await render.find(n, await github.authorise(current))
          if (service) knownServices.add(service.id)
        }
        if (current.state === 'closed') await cleanupPreview(current, systems)
        else if (Date.parse(record.expiresAt) <= Date.now()) {
          await cleanupPreview(current, systems, 'expired')
        }
      } catch {
        failures.push(n)
        await github.alert(current)
      }
    }
    if (
      (await neon.unknownBranches(known)).length ||
      (await render.unknownPreviews(knownServices)).length
    ) {
      await github.alertInventory()
      throw new Error('Unknown Preview resources require operator review')
    }
    if (failures.length) throw new Error('Preview reconciliation requires operator action')
    return
  }
  if (!pr) throw new Error('PR missing')
  if (acceptance === 'test-cleanup-failure') {
    const record = await github.record(pr.number)
    if (!record?.identity || !record.serviceId || record.phase === 'cleaned')
      throw new Error('Acceptance cleanup needs existing signed resources')
    await cleanupPreview(
      pr,
      withAcceptanceFailure(acceptance, systems),
      pr.state === 'closed' ? 'closed' : 'expired',
    )
    return
  }
  if (command === 'recreate' || acceptance === 'recreate-short-ttl') {
    if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || pr.state !== 'open')
      throw new Error('Recreation needs explicit operator dispatch')
    const record = await github.record(pr.number)
    if (!record || record.phase !== 'cleaned')
      throw new Error('Recreation requires confirmed cleanup first')
    // Do not replace the cleaned ownership record while a cleanup alert is unresolved.
    await github.assertAllocationAllowed()
    await assertCurrent(pr, github)
    await github.save({
      pr: pr.number,
      sha: pr.sha,
      phase: 'reserved',
      expiresAt: recreationExpiry(new Date(), acceptance),
    })
  }
  await reconcilePreview(pr, systems)
}

try {
  await main()
} catch {
  await reportFailure?.().catch(() => undefined)
  // Deliberately no raw error/stack: upstream SQL and API errors may carry credentials.
  console.error(
    '::error::Isolated Preview operation failed. Check PR state, approved digest, resource ownership, capacity and provider availability. Do not reset or attach a shared database.',
  )
  process.exitCode = 1
}
