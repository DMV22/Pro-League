import type { NextConfig } from 'next'
import { publicCacheProfiles } from './src/server/cache/profiles'
import { isRenderPreview } from './src/server/db/preview-target'

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: publicCacheProfiles,
  // Non-secret presentation flag, frozen separately for each Render Preview build.
  env: { PROLEAGUE_PREVIEW_BUILD: String(isRenderPreview()) },
}

export default nextConfig
