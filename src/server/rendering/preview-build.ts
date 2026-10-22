import { isRenderPreview } from '../db/preview-target'

/** Inlined by next.config.ts; never use this presentation flag to authorize data access. */
export function isPreviewBuild() {
  return process.env.PROLEAGUE_PREVIEW_BUILD === 'true'
}

export function assertPreviewBuildMatchesRuntime() {
  if (isPreviewBuild() !== isRenderPreview()) {
    throw new Error('Preview build/runtime mismatch; rebuild for the target environment')
  }
}
