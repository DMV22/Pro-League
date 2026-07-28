import { useAppSelector } from "@/store/hooks";
import { selectCurrentRound, selectTeamsList } from "./features/league/selectors/selectors";

function App() {
  const teamsList = useAppSelector(selectTeamsList);
  const currentRound = useAppSelector(selectCurrentRound);

  if (teamsList.length === 0) {
    return <div className="league-container">Команд не знайдено. Перевірте initialState.</div>;
  }

  return (
    <main className="league-container">
      <header className="league-header">
        <h2>Футбольна Ліга України</h2>
        <p><strong>Поточний тур:</strong> {currentRound}</p>
      </header>

      <section>
        <h3>Список команд та склад:</h3>
        <div className="teams-grid">
          {teamsList.map((team) => (
            <div key={team.id} className="team-card">
              <h4 className="team-name">
                ⚽ {team.name}
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
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
