export interface Team {
  id: string;
  name: string;
  budget: number;
  players: Player[];
}

export interface Player {
  id: string;
  name: string;
  position: 'GK' | 'DF' | 'MF' | 'FW';
  price: number;
}

export interface Match {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number;
  awayGoals: number;
  round: number;
  scorers: { playerId: string; goals: number }[];
}

export interface StandingsEntry {
  teamId: string;
  points: number;
  played: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  form: ('W' | 'D' | 'L')[];
}

export interface Transfer {
  id: string;
  fromTeamId: string;
  toTeamId: string;
  playerId: string;
  fee: number;
  date: string;
}

export interface LeagueState {
  teams: Record<string, Team>;
  matches: Record<string, Match>;
  standings: Record<string, StandingsEntry>;
  transfers: Record<string, Transfer>;
  currentRound: number;
}

export interface UiState {
  selectedTeamId: string | null;
  selectedRound: number | null;
  standingsSort: 'points' | 'goals' | 'alphabet' | 'form';
  playerFilter: {
    position?: 'GK' | 'DF' | 'MF' | 'FW';
    minPrice?: number;
    maxPrice?: number;
  };
}

export interface RootState {
  league: LeagueState;
  ui: UiState;
}