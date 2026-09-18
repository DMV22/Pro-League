import { uiText } from '@/shared/i18n/ui-text'

export default function HomePage() {
  return (
    <section className="portal-card" aria-labelledby="portal-title">
      <p className="portal-kicker">{uiText.public.kicker}</p>
      <h1 id="portal-title">{uiText.public.title}</h1>
      <p className="portal-summary">{uiText.public.summary}</p>
      <span className="portal-status">{uiText.public.status}</span>
    </section>
  )
}
