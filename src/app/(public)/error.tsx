'use client'

import { uiText } from '@/shared/i18n/ui-text'

export default function PublicError({ reset }: { reset: () => void }) {
  return (
    <section className="portal-card" role="alert" aria-labelledby="public-error-title">
      <h1 id="public-error-title">{uiText.feedback.errorTitle}</h1>
      <p className="portal-summary">{uiText.feedback.errorDescription}</p>
      <div>
        <button className="error-action" type="button" onClick={reset}>
          {uiText.feedback.retry}
        </button>
      </div>
    </section>
  )
}
