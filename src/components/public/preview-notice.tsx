import { connection } from 'next/server'
import type { ReactNode } from 'react'
import { isRenderPreview } from '@/server/db/preview-target'
import { uiText } from '@/shared/i18n/ui-text'

export async function PublicPreviewContent({ children }: Readonly<{ children: ReactNode }>) {
  await connection()
  // Resolve the notice and its following content in the same Suspense boundary.
  // A separately streamed notice would push an already painted page down.
  return (
    <>
      {isRenderPreview() && (
        <aside className="public-projection-status" aria-label={uiText.public.previewLabel}>
          <p>{uiText.public.previewNotice}</p>
        </aside>
      )}
      {children}
    </>
  )
}
