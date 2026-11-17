import 'server-only'
import { revalidateTag } from 'next/cache'
import type { PublicCacheTarget } from '../../modules/operations/application/cache-invalidation'
import { publicTags } from './public-tags'

/** Best-effort tag reclamation. Next flushes after the response; this is not a read barrier. */
export async function invalidatePublicCache(target: PublicCacheTarget): Promise<void> {
  const tag = target.kind === 'portal' ? publicTags.portal() : publicTags[target.kind](target.id)
  revalidateTag(tag, { expire: 0 })
}
