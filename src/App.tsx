import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCurrentRound, selectTeamsList } from "./features/league/selectors/league.selectors";
import { nextRound } from "./features/league/slices/league.slice";

import TeamsList from "./features/league/components/teams-list";
import DebugPanel from "./features/league/components/debug-panel";
import RoundMatches from "./features/league/components/round-matches";

function App() {
  const dispatch = useAppDispatch();

  const teamsList = useAppSelector(selectTeamsList);
  const currentRound = useAppSelector(selectCurrentRound);

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
      <TeamsList />
      {/* НОВИЙ ІНТЕРФЕЙС МАТЧІВ */}
      <RoundMatches />
      <DebugPanel />
    </main>
  )
}

export default App
