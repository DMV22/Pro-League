import { uiText } from '@/shared/i18n/ui-text'

export default function AdminHomePage() {
  return (
    <section className="admin-card" aria-labelledby="admin-title">
      <p className="portal-kicker">{uiText.admin.kicker}</p>
      <h1 id="admin-title">{uiText.admin.pageTitle}</h1>
      <p>{uiText.admin.summary}</p>
      <p className="admin-notice">{uiText.admin.authNotice}</p>
    </section>
  )
}
