import { LoadingState } from '@/components/ui/feedback-state'
import { uiText } from '@/shared/i18n/ui-text'

export default function AdminLoading() {
  return <LoadingState label={uiText.feedback.loadingAdmin} />
}
