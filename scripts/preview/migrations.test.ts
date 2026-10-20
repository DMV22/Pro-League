import { expect, it } from 'vitest'
import { withMigrationBundle } from './migrations'

it('rejects migration paths escaping the reviewed bundle', async () => {
  await expect(withMigrationBundle({ '../.env': 'secret' }, async () => undefined)).rejects.toThrow(
    'Unsafe migration bundle',
  )
})
