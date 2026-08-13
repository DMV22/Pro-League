import type { Team } from "@/shared/types/league";

interface TeamsListProps { 
  teamsList: Team[];
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
}

export default function TeamsList({ teamsList, selectedTeamId, onSelectTeam }: TeamsListProps) {
  return (
    <section>
      <h3 className="teams-title">Список команд (Клікніть на картку для вибору):</h3>
      <div className="teams-grid">
        {teamsList.map((team) => {
          const isSelected = team.id === selectedTeamId;

          return (
            <div
              key={team.id}
              onClick={() => onSelectTeam(team.id)}
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