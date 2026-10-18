import { connection } from 'next/server'
import { isRenderPreview } from '@/server/db/preview-target'
import { uiText } from '@/shared/i18n/ui-text'

export async function PreviewNotice() {
  await connection()
  if (!isRenderPreview()) return null
  return (
    <aside className="public-projection-status" aria-label={uiText.public.previewLabel}>
      <p>{uiText.public.previewNotice}</p>
    </aside>
  )
}
