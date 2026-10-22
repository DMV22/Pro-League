import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test.describe('Preview isolation before database access', () => {
  test.skip(
    process.env.PUBLIC_PREVIEW_GUARD_FIXTURE !== '1',
    'Explicit isolated server fixture only',
  )
  test('refuses to start a build in the opposite environment', async () => {
    const artifact = JSON.parse(readFileSync('.next/required-server-files.json', 'utf8'))
    const previewBuild = artifact.config.env.PROLEAGUE_PREVIEW_BUILD
    expect(['true', 'false']).toContain(previewBuild)
    const child = spawn(
      process.execPath,
      ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '0'],
      {
        env: {
          ...process.env,
          IS_PULL_REQUEST: String(previewBuild !== 'true'),
          RENDER_EXTERNAL_HOSTNAME: '',
          RENDER_EXTERNAL_URL: '',
        },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let diagnostic = ''
    child.stdout?.on('data', (chunk: Buffer) => (diagnostic += chunk.toString()))
    child.stderr?.on('data', (chunk: Buffer) => (diagnostic += chunk.toString()))
    try {
      await expect.poll(() => child.exitCode, { timeout: 20_000 }).not.toBeNull()
      expect(child.exitCode).not.toBe(0)
      expect(diagnostic).toContain('Preview build/runtime mismatch')
    } finally {
      await stop(child)
    }
  })
  test('missing and mismatched bindings serve no data and make zero database connections', async ({
    browser,
    page,
    request,
  }) => {
    test.setTimeout(90_000)
    let databaseConnections = 0
    const databaseTrap = createServer((socket) => {
      databaseConnections++
      socket.destroy()
    })
    databaseTrap.listen(0, '127.0.0.1')
    await once(databaseTrap, 'listening')
    const databaseAddress = databaseTrap.address()
    if (!databaseAddress || typeof databaseAddress === 'string') throw new Error('No trap port')
    try {
      for (const binding of [undefined, JSON.stringify({ projectId: 'development' })]) {
        const portHolder = createServer()
        portHolder.listen(0, '127.0.0.1')
        await once(portHolder, 'listening')
        const address = portHolder.address()
        if (!address || typeof address === 'string') throw new Error('No application port')
        await new Promise<void>((resolve) => portHolder.close(() => resolve()))
        const origin = `http://127.0.0.1:${address.port}`
        const environment: NodeJS.ProcessEnv = {
          ...process.env,
          IS_PULL_REQUEST: 'true',
          RENDER_EXTERNAL_HOSTNAME: 'pro-league-development-pr-105.onrender.com',
          RENDER_EXTERNAL_URL: 'https://pro-league-development-pr-105.onrender.com',
          DATABASE_URL: `postgresql://test:private@127.0.0.1:${databaseAddress.port}/proleague`,
          PREVIEW_DATABASE_IDENTITY: binding,
        }
        delete environment.NEON_API_KEY
        delete environment.MIGRATION_DATABASE_URL
        delete environment.SEED_DATABASE_URL
        const child = spawn(
          process.execPath,
          [
            'node_modules/next/dist/bin/next',
            'start',
            '--hostname',
            '127.0.0.1',
            '--port',
            String(address.port),
          ],
          { env: environment, windowsHide: true, stdio: 'ignore' },
        )
        try {
          await expect
            .poll(
              async () => {
                if (child.exitCode !== null) throw new Error('Isolated Preview test server exited')
                return (
                  await request.get(origin, { timeout: 1500 }).catch(() => undefined)
                )?.status()
              },
              { timeout: 30_000 },
            )
            .toBe(200)
          const staticContext = await browser.newContext({ javaScriptEnabled: false })
          try {
            const staticPage = await staticContext.newPage()
            await staticPage.goto(origin)
            await expect(staticPage.locator('#portal-title')).toBeVisible()
            await expect(
              staticPage.getByRole('complementary', { name: 'Тестове середовище' }),
            ).toBeVisible()
          } finally {
            await staticContext.close()
          }
          for (const route of [
            '/',
            '/competitions/golden-cup',
            '/competitions/golden-cup/seasons/2026-golden',
          ]) {
            await page.goto(origin + route)
            await expect(
              page.getByRole('complementary', { name: 'Тестове середовище' }),
            ).toBeVisible()
            await expect(
              page.getByText('Публічні дані тимчасово недоступні', { exact: true }),
            ).toBeVisible()
            await expect(page.getByText('Вигаданий кубок громад', { exact: true })).toHaveCount(0)
            await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
          }
          expect(databaseConnections).toBe(0)
        } finally {
          await stop(child)
        }
      }
    } finally {
      await new Promise<void>((resolve) => databaseTrap.close(() => resolve()))
    }
  })
})

async function stop(child: ChildProcess) {
  if (child.exitCode !== null) return
  const exited = once(child, 'exit')
  child.kill('SIGTERM')
  await exited
}
