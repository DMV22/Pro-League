import type { Match, Team } from "@/shared/types/league";

interface RoundMatchesProps {
  currentRound: number;
  teamsObj: Record<string, Team>;
  allMatches: Record<string, Match>;
  onSimulate: () => void;
}

export default function RoundMatches({ currentRound, teamsObj, allMatches, onSimulate }: RoundMatchesProps) {
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
          onClick={onSimulate}
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
