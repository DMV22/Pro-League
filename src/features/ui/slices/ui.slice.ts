import type { UiState } from "@/shared/types/league";
import { createSlice } from "@reduxjs/toolkit";

export const initialState: UiState = {
  selectedTeamId: null,
  selectedRound: null,
  standingsSort: "points",
  playerFilter: {}
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSelectedTeamId(state, action: { payload: string | null }) {
      state.selectedTeamId = action.payload;
    },
    setSelectedRound(state, action: { payload: number | null }) {
      state.selectedRound = action.payload;
    },
    setStandingsSort(state, action: { payload: UiState["standingsSort"] }) {
      state.standingsSort = action.payload;
    },
    setPlayerFilter(state, action: { payload: UiState["playerFilter"] }) {
      state.playerFilter = action.payload;
    },
  }
});

export const {
  setSelectedTeamId,
  setSelectedRound,
  setStandingsSort,
  setPlayerFilter,
} = uiSlice.actions;

export default uiSlice.reducer;
