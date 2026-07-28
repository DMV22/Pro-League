import type { RootState } from "@/store";

export const selectUiState = (state: RootState) => state.ui;
export const selectSelectedTeamId = (state: RootState) => state.ui.selectedTeamId;
export const selectStandingsSort = (state: RootState) => state.ui.standingsSort;