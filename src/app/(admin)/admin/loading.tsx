import { uiText } from '@/shared/i18n/ui-text'

export default function AdminLoading() {
  return (
    <p className="route-status" role="status" aria-live="polite">
      {uiText.feedback.loadingAdmin}
    </p>
  )
}
