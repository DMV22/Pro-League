import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCurrentRound, selectFilteredPlayers, selectMatches, selectStandings, selectTeams, selectTeamsList } from "./features/league/selectors/league.selectors";
import { nextRound, simulateMatchday } from "./features/league/slices/league.slice";

import TeamsList from "./features/league/components/teams-list";
import DebugPanel from "./features/league/components/debug-panel";
import RoundMatches from "./features/league/components/round-matches";
import { selectSelectedTeamId, selectStandingsSort } from "./features/ui/selectors/ui.selectors";
import { setSelectedTeamId, setStandingsSort } from "./features/ui/slices/ui.slice";

function App() {
  const dispatch = useAppDispatch();

  // Збір бізнес-даних ліги
  const teamsList = useAppSelector(selectTeamsList);
  const teamsObj = useAppSelector(selectTeams);
  const currentRound = useAppSelector(selectCurrentRound) ?? 1;
  const allMatches = useAppSelector(selectMatches);
  const standingsList = useAppSelector(selectStandings);
  const filteredPlayers = useAppSelector(selectFilteredPlayers);

  // Збір стану UI
  const selectedTeamId = useAppSelector(selectSelectedTeamId);
  const currentSort = useAppSelector(selectStandingsSort);

  // Централізовані обробники подій (колбеки)

  // Handler для кліку на картку команди
  const handleSelectTeam = (teamId: string) => {
    // Якщо команда вже вибрана - знімаємо виділення (null), інакше - вибираємо
    const nextId = selectedTeamId === teamId ? null : teamId;
    dispatch(setSelectedTeamId(nextId));
  };

  const handleSimulateMatchday = () => {
    dispatch(simulateMatchday());
  };

  const handleSortChange = (sortType: typeof currentSort) => {
    dispatch(setStandingsSort(sortType));
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
          onClick={() => dispatch(nextRound())}
          className="btn-next-round"
        >
          Наступний тур ➔
        </button>
      </header>

      {/* Передаємо пропси в чисті компоненти */}
      <TeamsList
        teamsList={teamsList}
        selectedTeamId={selectedTeamId}
        onSelectTeam={handleSelectTeam}
      />

      <RoundMatches
        currentRound={currentRound}
        teamsObj={teamsObj}
        allMatches={allMatches}
        onSimulate={handleSimulateMatchday}
      />

      <DebugPanel
        teamsObj={teamsObj}
        standingsList={standingsList}
        filteredPlayers={filteredPlayers}
        currentSort={currentSort}
        onSortChange={handleSortChange}
      />
    </main>
  )
}

export default App
