import { useAppDispatch, useAppSelector } from "@/store/hooks";

import { simulateMatchday } from "@/features/league/slices/league.slice";
import { selectCurrentRound, selectMatches, selectTeams } from "@/features/league/selectors/league.selectors";

export default function RoundMatches() {
  const dispatch = useAppDispatch();

  const currentRound = useAppSelector(selectCurrentRound) ?? 1;
  const teamsObj = useAppSelector(selectTeams);
  const allMatches = useAppSelector(selectMatches);

  // Фільтруємо загальний масив матчів, залишаючи тільки ті, які належать до ПОТОЧНОГО туру (Derived State)
  const currentRoundMatches = Object.values(allMatches).filter(
    (match) => match.round === currentRound
  );

  return (
    <section className="matches-section">
      <div className="matches-controls">
        <h3 className="matches-title">
          📅 Матчі {currentRound}-го туру
        </h3>
        <button
          onClick={() => dispatch(simulateMatchday())}
          className="btn-generate-matches"
        >
          🎲 Згенерувати випадкові матчі
        </button>
      </div>

      {currentRoundMatches.length === 0 ? (
        <div className="matches-empty-state">
          Натисніть кнопку вище, щоб розіграти матчі та згенерувати результати цього туру
        </div>
      ) : (
        <div className="matches-grid">
          {currentRoundMatches.map((match) => {
            const homeName = teamsObj[match.homeTeamId]?.name || match.homeTeamId;
            const awayName = teamsObj[match.awayTeamId]?.name || match.awayTeamId;

            return (
              <div key={match.id} className="match-score-card">
                <span className="match-team-name-side text-right truncate">
                  {homeName}
                </span>

                <div className="match-score-display">
                  {match.homeGoals} : {match.awayGoals}
                </div>

                <span className="match-team-name-side truncate">
                  {awayName}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
