import type { LeagueState } from "@/shared/types/league";
import { createSlice } from "@reduxjs/toolkit";

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
  }
});

export const { nextRound } = leagueSlice.actions;

export default leagueSlice.reducer;