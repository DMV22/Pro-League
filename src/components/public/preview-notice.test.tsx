import { PassThrough } from 'node:stream'
import { Suspense } from 'react'
import { renderToPipeableStream } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'

const { connection, isRenderPreview } = vi.hoisted(() => ({
  connection: vi.fn(),
  isRenderPreview: vi.fn(),
}))

vi.mock('next/server', () => ({ connection }))
vi.mock('@/server/db/preview-target', () => ({ isRenderPreview }))

import { PublicPreviewContent } from './preview-notice'
import PublicLayout from '@/app/(public)/layout'

afterEach(() => vi.resetAllMocks())

it.each([true, false])('streams the notice and page together (Preview=%s)', async (preview) => {
  let release!: () => void
  connection.mockReturnValue(new Promise<void>((resolve) => (release = resolve)))
  isRenderPreview.mockReturnValue(preview)

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
      <h1>Page content</h1>
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
    expect(html).toContain('ProLeague')
    expect(html).not.toContain('Page content')
    expect(html).not.toContain('Тестовий PR Preview')
    release()
    const finished = await complete
    expect(finished).toContain('Page content')
    if (preview) {
      expect(finished).toContain('Тестовий PR Preview')
      expect(finished.indexOf('Тестовий PR Preview')).toBeLessThan(finished.indexOf('Page content'))
    } else {
      expect(finished).not.toContain('Тестовий PR Preview')
      expect(finished).not.toContain('public-projection-status')
    }
  } finally {
    stream.abort()
    output.destroy()
  }
})

it('keeps nested data sections streamable after the notice resolves', async () => {
  connection.mockResolvedValue(undefined)
  isRenderPreview.mockReturnValue(true)
  const content = await PublicPreviewContent({
    children: (
      <Suspense fallback={<p>Loading data</p>}>
        <p>Independent data section</p>
      </Suspense>
    ),
  })
  // The wrapper must not fetch or await the page's data itself.
  expect(content.props.children[1].type).toBe(Suspense)
  expect(connection).toHaveBeenCalledOnce()
})
