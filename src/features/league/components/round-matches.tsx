import { useAppDispatch, useAppSelector } from "@/store/hooks";

import { simulateMatchday } from "@/features/league/slices/league.slice";
import { selectCurrentRound, selectMatches, selectTeams } from "@/features/league/selectors/league.selectors";

export default function RoundMatches() {
  const dispatch = useAppDispatch();

  const currentRound = useAppSelector(selectCurrentRound) ?? 1;
  const teamsObj = useAppSelector(selectTeams);
  const allMatches = useAppSelector(selectMatches);

  const matchesList = Object.values(allMatches);

  // 1. Визначаємо, який тур зараз показувати в блоці результатів (Derived State)
  // Шукаємо, чи є матчі для поточного туру
  const hasMatchesForCurrentRound = matchesList.some(m => m.round === currentRound);

  // Якщо матчів для нового туру немає, а поточний тур > 1, показуємо результати останнього зіграного туру
  const roundToDisplay = hasMatchesForCurrentRound ? currentRound : (currentRound > 1 ? currentRound - 1 : currentRound);

  // 2. Фільтруємо матчі строго для визначеного туру
  const roundMatches = matchesList.filter((match) => match.round === roundToDisplay);

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

      {roundMatches.length === 0 ? (
        <div className="matches-empty-state">
          Чемпіонат ще не розпочався. Натисніть кнопку, щоб симулювати матчі 1-го туру!
        </div>
      ) : (
        <div className="matches-grid">
          {roundMatches.map((match) => {
            const homeName = teamsObj[match.homeTeamId]?.name || `ID: ${match.homeTeamId}`;
            const awayName = teamsObj[match.awayTeamId]?.name || `ID: ${match.awayTeamId}`;

            return (
              <div key={match.id} className="match-score-card">
                <span className="match-team-side-home">
                  {homeName}
                </span>

                <div className="match-score-display">
                  {match.homeGoals} : {match.awayGoals}
                </div>

                <span className="match-team-side-away">
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
