export default function HomePage() {
  return (
    <main className="portal-shell">
      <section className="portal-card" aria-labelledby="portal-title">
        <p className="portal-kicker">ProLeague Portal</p>
        <h1 id="portal-title">Нова платформа місцевого футболу</h1>
        <p className="portal-summary">
          Базова оболонка готова. Новини, турніри, календарі та результати будуть
          додаватися послідовними вертикальними зрізами.
        </p>
        <span className="portal-status">Next.js foundation · online</span>
      </section>
    </main>
  )
}
