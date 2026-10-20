import { expect, it } from 'vitest'
import { verifyPublicPreview } from './readiness'

it('never browses a supplied non-Preview origin', async () => {
  await expect(verifyPublicPreview('https://example.com', 120)).rejects.toThrow(
    'Preview origin differs',
  )
})
