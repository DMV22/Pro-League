import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectTeamsList } from "@/features/league/selectors/league.selectors";
import { selectSelectedTeamId } from "@/features/ui/selectors/ui.selectors";
import { setSelectedTeamId } from "@/features/ui/slices/ui.slice";

export default function TeamsList() {
  const dispatch = useAppDispatch();
  const teamsList = useAppSelector(selectTeamsList);
  const selectedTeamId = useAppSelector(selectSelectedTeamId);

  // Handler для кліку на картку команди
  const handleSelectTeam = (teamId: string) => {
    // Якщо команда вже вибрана - знімаємо виділення (null), інакше - вибираємо
    const nextId = selectedTeamId === teamId ? null : teamId;
    dispatch(setSelectedTeamId(nextId));
  };

  return (
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
  )
}