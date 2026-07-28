import type { RootState } from "@/store";

export const selectLeague = (state: RootState) => state.league;

export const selectTeams = (state: RootState) => state.league.teams;
export const selectCurrentRound = (state: RootState) => state.league.currentRound;
