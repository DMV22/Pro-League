import type { Team } from "@/shared/types/league";
import type { RootState } from "@/store";
import { createSelector } from "@reduxjs/toolkit";

export const selectLeague = (state: RootState) => state.league;

export const selectTeams = (state: RootState) => state.league.teams;
export const selectCurrentRound = (state: RootState) => state.league.currentRound;

export const selectTeamsList = createSelector(
  [selectTeams], // Вхідна залежність
  (teamsObj): Team[] => {
    console.log("Селектор обчислив новий масив команд!"); // Спрацює тільки якщо зміняться команди
    return Object.values(teamsObj);
  }
);