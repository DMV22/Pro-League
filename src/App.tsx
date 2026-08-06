import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCurrentRound, selectFilteredPlayers, selectStandings, selectTeams, selectTeamsList } from "./features/league/selectors/league.selectors";
import { selectSelectedTeamId } from "./features/ui/selectors/ui.selectors";
import { setSelectedTeamId } from "./features/ui/slices/ui.slice";
import { nextRound } from "./features/league/slices/league.slice";
import type { Player } from "./shared/types/league";

function App() {
  const dispatch = useAppDispatch();

  const teamsList = useAppSelector(selectTeamsList);

  const teamsObj = useAppSelector(selectTeams);
  const currentRound = useAppSelector(selectCurrentRound);
  const selectedTeamId = useAppSelector(selectSelectedTeamId);

  const standingsList = useAppSelector(selectStandings);
  const filteredPlayers = useAppSelector(selectFilteredPlayers);

  // Handler для зміни туру (для демонстрації dispatch)
  const handleNextRound = () => {
    dispatch(nextRound());
  };

  // Handler для кліку на картку команди
  const handleSelectTeam = (teamId: string) => {
    // Якщо команда вже вибрана - знімаємо виділення (null), інакше - вибираємо
    const nextId = selectedTeamId === teamId ? null : teamId;
    dispatch(setSelectedTeamId(nextId));
  };

  // Функція для стилізації бейджів форми останніх матчів (W, D, L)
  const formClassMap: Record<'W' | 'D' | 'L', string> = {
    W: 'form-badge-w',
    D: 'form-badge-d',
    L: 'form-badge-l',
  };
  // Функція для стилізації бейджів позицій гравців
  const positionClassMap: Record<Player['position'], string> = {
    GK: 'position-badge-gk',
    DF: 'position-badge-df',
    MF: 'position-badge-mf',
    FW: 'position-badge-fw',
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
      <section className="debug-section">
        <div className="debug-grid">

          {/* ТУРНІРНА ТАБЛИЦЯ */}
          <div className="standings-wrapper">
            <div className="panel-header">
              <h3 className="panel-title">📊 Поточна турнірна таблиця</h3>
            </div>

            <div className="table-scroll">
              <table className="table-main">
                <thead className="table-thead">
                  <tr className="table-row-header">
                    <th className="cell-shared-padding text-center w-12">#</th>
                    <th className="cell-shared-padding">Команда</th>
                    <th className="header-center">I</th>
                    <th className="header-center">ЗГ</th>
                    <th className="header-center">ПГ</th>
                    <th className="header-center">РГ</th>
                    <th className="cell-shared-padding text-center font-bold text-gray-900 w-16">О</th>
                    <th className="cell-shared-padding">Форма</th>
                  </tr>
                </thead>
                <tbody className="table-tbody">
                  {standingsList.map((entry, index) => {
                    const teamName = teamsObj[entry.teamId]?.name || `Команда (${entry.teamId})`;

                    return (
                      <tr key={entry.teamId} className="table-row-body">
                        <td className="rank">{index + 1}</td>
                        <td className="team">{teamName}</td>
                        <td className="stat-center">{entry.played}</td>
                        <td className="stat-muted">{entry.goalsFor}</td>
                        <td className="stat-muted">{entry.goalsAgainst}</td>
                        <td className={`stat-center ${entry.goalDiff > 0 ? 'text-green-600' : entry.goalDiff < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                          {entry.goalDiff > 0 ? `+${entry.goalDiff}` : entry.goalDiff}
                        </td>
                        <td className="points">{entry.points}</td>
                        <td className="form">
                          {entry.form.length > 0 ? (
                            entry.form.map((res, i) => (
                              <span key={i} className={`form-badge ${formClassMap[res]}`}>
                                {res}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* СПИСОК ГРАВЦІВ */}
          <div className="players-wrapper">
            <div className="panel-header">
              <h3 className="panel-title">
                🏃 Гравці за фільтром
                <span className="players-count-badge">{filteredPlayers.length}</span>
              </h3>
            </div>

            <div className="players-container">
              {filteredPlayers.length === 0 ? (
                <div className="players-empty">Гравців за критеріями не знайдено</div>
              ) : (
                filteredPlayers.map((player) => (
                  <div key={player.id} className="player-row">
                    <div className="player-info">
                      <span className="players-name">{player.name}</span>
                      <span className="player-meta">
                        ID: <span className="player-meta-id">{player.id}</span>
                      </span>
                    </div>
                    <div className="player-side-block">
                      <span className={`position-badge ${positionClassMap[player.position]}`}>
                        {player.position}
                      </span>
                      <span className="player-price-badge">
                        €{(player.price / 1000000).toFixed(1)}M
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
