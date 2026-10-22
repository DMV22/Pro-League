import { afterEach, expect, it, vi } from 'vitest'
import { assertPreviewBuildMatchesRuntime } from './preview-build'
import { register } from '@/instrumentation'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it.each([
  [false, false],
  [true, true],
  [false, true],
  [true, false],
])('requires build=%s and runtime=%s to match', async (build, runtime) => {
  vi.stubEnv('PROLEAGUE_PREVIEW_BUILD', String(build))
  vi.stubEnv('IS_PULL_REQUEST', String(runtime))
  vi.stubEnv('RENDER_EXTERNAL_HOSTNAME', '')
  vi.stubEnv('RENDER_EXTERNAL_URL', '')
  vi.stubEnv('NEXT_RUNTIME', 'nodejs')
  if (build === runtime) {
    expect(assertPreviewBuildMatchesRuntime).not.toThrow()
    await expect(register()).resolves.toBeUndefined()
  } else {
    expect(assertPreviewBuildMatchesRuntime).toThrow('Preview build/runtime mismatch')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process terminated')
    })
    await expect(register()).rejects.toThrow('Process terminated')
    expect(exit).toHaveBeenCalledWith(1)
  }
})

it('rejects a normal build on a Preview hostname even without IS_PULL_REQUEST', () => {
  vi.stubEnv('PROLEAGUE_PREVIEW_BUILD', 'false')
  vi.stubEnv('IS_PULL_REQUEST', '')
  vi.stubEnv('RENDER_EXTERNAL_HOSTNAME', 'pro-league-development-pr-106.onrender.com')
  expect(assertPreviewBuildMatchesRuntime).toThrow('Preview build/runtime mismatch')
})
