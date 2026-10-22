import { isPreviewBuild } from '@/server/rendering/preview-build'
import { uiText } from '@/shared/i18n/ui-text'

export function PreviewNotice() {
  if (!isPreviewBuild()) return null
  // Render in the static shell: no late insertion and no request-time gate around the page.
  return (
    <aside className="public-projection-status" aria-label={uiText.public.previewLabel}>
      <p>{uiText.public.previewNotice}</p>
    </aside>
  )
}
