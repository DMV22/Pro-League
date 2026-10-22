import { assertPreviewBuildMatchesRuntime } from './preview-build'

export function registerPreviewBuild() {
  try {
    assertPreviewBuildMatchesRuntime()
  } catch (error) {
    // Next can retain its listening process after a rejected instrumentation hook.
    // A mismatched artifact must terminate rather than report a healthy startup.
    console.error(error instanceof Error ? error.message : 'Preview build/runtime mismatch')
    process.exit(1)
  }
}
