import type { NextConfig } from 'next'
import { publicCacheProfiles } from './src/server/cache/profiles'

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: publicCacheProfiles,
}

export default nextConfig
