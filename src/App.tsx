import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCurrentRound, selectTeamsList } from "./features/league/selectors/league.selectors";
import { selectSelectedTeamId } from "./features/ui/selectors/ui.selectors";
import { setSelectedRound, setSelectedTeamId } from "./features/ui/slices/ui.slice";

function App() {
  const dispatch = useAppDispatch();

  const teamsList = useAppSelector(selectTeamsList);
  const currentRound = useAppSelector(selectCurrentRound);
  const selectedTeamId = useAppSelector(selectSelectedTeamId);

  // Handler для зміни туру (для демонстрації dispatch)
  const handleNextRound = () => {
    if (currentRound) {
      dispatch(setSelectedRound(currentRound + 1));
    }
  };

  // Handler для кліку на картку команди
  const handleSelectTeam = (teamId: string) => {
    // Якщо команда вже вибрана - знімаємо виділення (null), інакше - вибираємо
    const nextId = selectedTeamId === teamId ? null : teamId;
    dispatch(setSelectedTeamId(nextId));
  };

  if (teamsList.length === 0) {
    return <div className="league-container">Команд не знайдено. Перевірте initialState.</div>;
  }

  return (
    <main className="league-container">
      <header className="league-header">
        <div>
          <h2 className="league-title">⚽ Футбольна Ліга України</h2>
          <p className="league-round"><strong>Поточний тур:</strong> {currentRound ?? 1}</p>
        </div>
        <button
          onClick={handleNextRound}
          className="btn-next-round"
        >
          Наступний тур ➔
        </button>
      </header>

      <section>
        <h3 className="teams-title">Список команд (Клікніть на картку для вибору):</h3>
        <div className="teams-grid">
          {teamsList.map((team) => {
            const isSelected = team.id === selectedTeamId;

            return (
              <div
                key={team.id}
                onClick={() => handleSelectTeam(team.id)}
                className={`team-card ${isSelected ? 'team-card-selected' : ''}`}
              >
                <h4 className="team-name">
                  {isSelected ? '⭐ ' : ''}{team.name}
                </h4>
                <p className="team-budget">
                  <strong>Бюджет:</strong> €{team.budget.toLocaleString()}
                </p>

                <h5 className="players-title">Гравці ({team.players.length}):</h5>
                <ul className="players-list">
                  {team.players.map((player) => (
                    <li key={player.id} className="player-item">
                      <strong>[{player.position}]</strong> {player.name} — €{player.price.toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  )
}

export default App
