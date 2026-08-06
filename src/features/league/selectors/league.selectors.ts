import type { Player, StandingsEntry, Team } from "@/shared/types/league";
import type { RootState } from "@/store";
import { createSelector } from "@reduxjs/toolkit";

export const selectLeague = (state: RootState) => state.league;

export const selectTeams = (state: RootState) => state.league.teams;
export const selectMatches = (state: RootState) => state.league.matches;
export const selectCurrentRound = (state: RootState) => state.league.currentRound;

const selectPlayerFilter = (state: RootState) => state.ui.playerFilter;

export const selectTeamsList = createSelector(
  [selectTeams], // Вхідна залежність
  (teamsObj): Team[] => {
    console.log("Селектор обчислив новий масив команд!"); // Спрацює тільки якщо зміняться команди
    return Object.values(teamsObj);
  }
);

export const selectStandings = createSelector(
  [selectTeams, selectMatches],
  (teams, matches): StandingsEntry[] => {
    // 1. Ініціалізуємо standings по кожній команді
    const baseEntries: Record<string, StandingsEntry> = {};

    Object.values(teams).forEach((team) => {
      baseEntries[team.id] = {
        teamId: team.id,
        points: 0,
        played: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        form: [],
      };
    });

    // 2. Проходимо по всіх матчах і оновлюємо статистику
    Object.values(matches).forEach((match) => {
      const home = baseEntries[match.homeTeamId];
      const away = baseEntries[match.awayTeamId];
      if (!home || !away) return;

      home.played += 1;
      away.played += 1;

      home.goalsFor += match.homeGoals;
      home.goalsAgainst += match.awayGoals;
      away.goalsFor += match.awayGoals;
      away.goalsAgainst += match.homeGoals;

      home.goalDiff = home.goalsFor - home.goalsAgainst;
      away.goalDiff = away.goalsFor - away.goalsAgainst;

      if (match.homeGoals > match.awayGoals) {
        home.points += 3;
        home.form.push("W");
        away.form.push("L");
      } else if (match.homeGoals < match.awayGoals) {
        away.points += 3;
        away.form.push("W");
        home.form.push("L");
      } else {
        home.points += 1;
        away.points += 1;
        home.form.push("D");
        away.form.push("D");
      }
    });

    // 3. Повертаємо масив, відсортований за очками (і goalDiff як тайбрейкер)
    const standings = Object.values(baseEntries);

    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      return b.goalsFor - a.goalsFor;
    });

    return standings;
  }
);

export const selectFilteredPlayers = createSelector(
  [selectTeams, selectPlayerFilter],
  (teams, filter): Player[] => {
    const allPlayers = Object.values(teams).flatMap((team) => team.players);

    return allPlayers.filter((player) => {
      if (filter.position && player.position !== filter.position) return false;
      if (filter.minPrice !== undefined && player.price < filter.minPrice) return false;
      if (filter.maxPrice !== undefined && player.price > filter.maxPrice) return false;
      return true;
    });
  }
);