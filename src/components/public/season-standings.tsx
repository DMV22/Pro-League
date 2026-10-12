import type { ProvisionalLeagueStandings } from '@/modules/standings-progression/domain/provisional-league-standings'
import { uiText } from '@/shared/i18n/ui-text'

export function SeasonStandings({ stages }: { stages: ProvisionalLeagueStandings[] }) {
  const columns = uiText.public.standingsColumns
  const statistics = [
    'played',
    'wins',
    'draws',
    'losses',
    'goalsFor',
    'goalsAgainst',
    'goalDifference',
    'adjustment',
    'points',
  ] as const
  return (
    <section className="public-section" aria-labelledby="season-standings-title">
      <div className="public-section-heading">
        <h2 id="season-standings-title">{uiText.public.standingsTitle}</h2>
        <p>{uiText.public.standingsDescription}</p>
      </div>
      {stages.length === 0 && <p>{uiText.public.standingsEmpty}</p>}
      {stages.map((stage) => (
        <section key={stage.stageId} aria-labelledby={`standings-${stage.stageId}`}>
          <h3 id={`standings-${stage.stageId}`}>{stage.stageName}</h3>
          {stage.kind === 'unavailable' ? (
            <p>{uiText.public.standingsUnavailable[stage.reason]}</p>
          ) : (
            <div
              className="public-standings-scroll"
              role="region"
              aria-label={`${uiText.public.standingsTitle}: ${stage.stageName}`}
              tabIndex={0}
            >
              <table className="public-standings-table">
                <caption>
                  {stage.stageName} — {uiText.public.standingsTitle}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{columns.position}</th>
                    <th scope="col">{columns.teamName}</th>
                    {statistics.map((key) => (
                      <th key={key} scope="col">
                        {columns[key]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stage.rows.map((row) => (
                    <tr key={row.seasonEntryId}>
                      <td>{row.position}</td>
                      <th scope="row">{row.teamName}</th>
                      {statistics.map((key) => (
                        <td key={key}>{row[key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </section>
  )
}
