import { uiText } from '@/shared/i18n/ui-text'

export function ProjectionStatus({
  freshness,
  lastUpdatedAt,
  synchronization,
}: {
  freshness: 'fresh' | 'stale'
  lastUpdatedAt: string | null
  synchronization?: 'pending' | 'attention'
}) {
  return (
    <aside className="public-projection-status" aria-label={uiText.public.freshnessLabel}>
      {lastUpdatedAt && (
        <p>
          {uiText.public.lastUpdated}:{' '}
          <time dateTime={lastUpdatedAt}>
            {new Intl.DateTimeFormat('uk-UA', {
              timeZone: 'Europe/Kyiv',
              dateStyle: 'long',
              timeStyle: 'short',
            }).format(new Date(lastUpdatedAt))}
          </time>
        </p>
      )}
      {freshness === 'stale' && <p role="status">{uiText.public.staleWarning}</p>}
      {synchronization === 'attention' && <p role="status">{uiText.public.cacheSyncWarning}</p>}
    </aside>
  )
}
