import type { LeagueState, Match, Transfer } from "@/shared/types/league";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { generatePairings, randomScore } from "@/features/league/slices/league.helpers";

export const initialState: LeagueState = {
  teams: {
    't1': {
      id: 't1',
      name: 'FC Dynamo Kyiv',
      budget: 50000000,
      players: [
        { id: 'p1', name: 'Heorhiy Bushchan', position: 'GK', price: 7000000 },
        { id: 'p2', name: 'Mykola Shaparenko', position: 'MF', price: 9000000 },
        { id: 'p3', name: 'Vladyslav Vanat', position: 'FW', price: 7000000 }
      ]
    },
    't2': {
      id: 't2',
      name: 'FC Shakhtar Donetsk',
      budget: 80000000,
      players: [
        { id: 'p4', name: 'Dmytro Riznyk', position: 'GK', price: 5000000 },
        { id: 'p5', name: 'Mykola Matviyenko', position: 'DF', price: 18000000 },
        { id: 'p6', name: 'Heorhiy Sudakov', position: 'MF', price: 35000000 }
      ]
    },
    't3': {
      id: 't3',
      name: 'FC Kryvbas',
      budget: 15000000,
      players: [
        { id: 'p7', name: 'Volodymyr Makhankov', position: 'GK', price: 500000 },
        { id: 'p8', name: 'Tymur Stetskov', position: 'DF', price: 1200000 },
        { id: 'p9', name: 'Oleh Kozhushko', position: 'FW', price: 1000000 }
      ]
    },
    't4': {
      id: 't4',
      name: 'FC Polissya Zhytomyr',
      budget: 25000000,
      players: [
        { id: 'p10', name: 'Yevhen Volynets', position: 'GK', price: 1000000 },
        { id: 'p11', name: 'Oleksiy Hutsulyak', position: 'MF', price: 2500000 },
        { id: 'p12', name: 'Pylyp Budkivskyi', position: 'FW', price: 500000 }
      ]
    },
    't5': {
      id: 't5',
      name: 'FC Rukh Lviv',
      budget: 12000000,
      players: [
        { id: 'p13', name: 'Yuriy-Volodymyr Gereta', position: 'GK', price: 300000 },
        { id: 'p14', name: 'Bohdan Slyubyk', position: 'DF', price: 3000000 },
        { id: 'p15', name: 'Ilya Kvasnytsya', position: 'MF', price: 2500000 }
      ]
    }
  },
  matches: {},
  standings: {},
  transfers: {},
  currentRound: 1
};

const leagueSlice = createSlice({
  name: 'league',
  initialState,
  reducers: {
    nextRound(state) {
      state.currentRound += 1;
    },
    addMatchResult(state, action: { payload: Match }) {

      // 1. Save the match in the dictionary
      const { id, homeTeamId, awayTeamId, homeGoals, awayGoals, round } = action.payload;
      state.matches[id] = {
        id,
        homeTeamId,
        awayTeamId,
        homeGoals,
        awayGoals,
        round,
        scorers: []
      };

      // TODO: update standings entries based on this match
    },

    transferPlayer(state, action: PayloadAction<Transfer>) {
      const { playerId, fromTeamId, toTeamId, fee } = action.payload;

      const fromTeam = state.teams[fromTeamId];
      const toTeam = state.teams[toTeamId];

      if (!fromTeam || !toTeam) {
        console.warn("transferPlayer: invalid team ids", { fromTeamId, toTeamId });
        return;
      }

      const playerIndex = fromTeam.players.findIndex((p) => p.id === playerId);
      if (playerIndex === -1) {
        console.warn("transferPlayer: player not found in fromTeam", { playerId, fromTeamId });
        return;
      }

      const player = fromTeam.players[playerIndex];

      // Перевірка бюджету (не дозволяємо негативний бюджет)
      if (toTeam.budget < fee) {
        console.warn("transferPlayer: insufficient budget", { toTeamId, fee, budget: toTeam.budget });
        return;
      }

      // 1. Забираємо гравця з fromTeam
      fromTeam.players.splice(playerIndex, 1);
      fromTeam.budget += fee;

      // 2. Додаємо гравця до toTeam
      toTeam.players.push(player);
      toTeam.budget -= fee;

      // 3. (Опційно) фіксуємо трансфер в окремому словнику
      const transferId = `${playerId}-${fromTeamId}-${toTeamId}-${Date.now()}`;
      state.transfers[transferId] = {
        id: transferId,
        fromTeamId,
        toTeamId,
        playerId,
        fee,
        date: new Date().toISOString(),
      };
    },

    simulateMatchday(state) {
      const teamIds = Object.keys(state.teams);
      if (teamIds.length < 2) return;

      const pairings = generatePairings(teamIds);

      pairings.forEach(([homeTeamId, awayTeamId], index) => {
        const { homeGoals, awayGoals } = randomScore();

        const matchId = `m-${state.currentRound}-${index}`;

        state.matches[matchId] = {
          id: matchId,
          homeTeamId,
          awayTeamId,
          homeGoals,
          awayGoals,
          round: state.currentRound,
          scorers: [], // додати пізніше
        };
      });

      state.currentRound += 1;
    },
  }
});

export const { nextRound, addMatchResult, transferPlayer, simulateMatchday } = leagueSlice.actions;

export default leagueSlice.reducer;