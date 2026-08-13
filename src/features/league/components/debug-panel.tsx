import type { Player, StandingsEntry, Team, UiState } from "@/shared/types/league";

interface DebugPanelProps {
  teamsObj: Record<string, Team>;
  standingsList: StandingsEntry[];
  filteredPlayers: Player[];
  currentSort: UiState['standingsSort'];
  onSortChange: (sortType: UiState['standingsSort']) => void;
}

export default function DebugPanel({ teamsObj, standingsList, filteredPlayers, currentSort, onSortChange }: DebugPanelProps) {

  // Конфігурація для кнопок сортування
  const sortOptions: { value: UiState['standingsSort']; label: string }[] = [
    { value: 'points', label: '🏆 Очки' },
    { value: 'goals', label: '⚽ Голи' },
    { value: 'alphabet', label: '🔤 Алфавіт' },
    { value: 'form', label: '📈 Форма' },
  ];

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

  return (
    <section className="debug-section">
      <div className="debug-grid">

        {/* ТУРНІРНА ТАБЛИЦЯ */}
        <div className="standings-wrapper">
          <div className="panel-header">
            <h3 className="panel-title">📊 Поточна турнірна таблиця</h3>
          </div>

          <div className="p-5 pb-0">
            {/* 2. БЛОК ІНТЕРАКТИВНОГО СОРТУВАННЯ */}
            <div className="sort-panel">
              <span className="sort-panel-title">Сортувати за:</span>
              {sortOptions.map((option) => {
                const isActive = currentSort === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => onSortChange(option.value)}
                    className={`btn-sort ${isActive ? 'btn-sort-active' : ''}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
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
  )
}