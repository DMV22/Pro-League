import { PassThrough } from 'node:stream'
import { Suspense, use } from 'react'
import { renderToPipeableStream } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'

import PublicLayout from '@/app/(public)/layout'

afterEach(() => vi.unstubAllEnvs())

it.each([true, false])(
  'renders the hero in the initial shell (Preview build=%s)',
  async (preview) => {
    vi.stubEnv('PROLEAGUE_PREVIEW_BUILD', String(preview))
    let release!: () => void
    const data = new Promise<string>((resolve) => (release = () => resolve('Loaded data')))
    function DataSection() {
      return <p>{use(data)}</p>
    }
    const output = new PassThrough()
    let html = ''
    output.on('data', (chunk: Buffer) => (html += chunk.toString()))
    const complete = new Promise<string>((resolve, reject) => {
      output.on('end', () => resolve(html))
      output.on('error', reject)
    })
    let shellReady!: () => void
    const shell = new Promise<void>((resolve) => (shellReady = resolve))
    const stream = renderToPipeableStream(
      <PublicLayout>
        <h1>Page hero</h1>
        <Suspense fallback={<p>Loading data</p>}>
          <DataSection />
        </Suspense>
      </PublicLayout>,
      {
        onShellReady() {
          stream.pipe(output)
          shellReady()
        },
        onError(error) {
          output.destroy(error instanceof Error ? error : new Error(String(error)))
        },
      },
    )
    try {
      await shell
      expect(html).toContain('Page hero')
      expect(html).toContain('Loading data')
      expect(html).not.toContain('Loaded data')
      if (preview) {
        expect(html).toContain('Тестовий PR Preview')
        expect(html.indexOf('Тестовий PR Preview')).toBeLessThan(html.indexOf('Page hero'))
      } else {
        expect(html).not.toContain('Тестовий PR Preview')
        expect(html).not.toContain('public-projection-status')
      }
      release()
      expect(await complete).toContain('Loaded data')
    } finally {
      stream.abort()
      output.destroy()
    }
  },
)
