import { selectFilteredPlayers, selectStandings } from "./league.selectors";
import type { RootState } from "@/store";

describe("League Selectors", () => {

  test("selectStandings computes points and sorts by points by default", () => {
    const state = {
      league: {
        teams: {
          t1: { id: "t1", name: "Team A", budget: 0, players: [] },
          t2: { id: "t2", name: "Team B", budget: 0, players: [] },
        },
        matches: {
          m1: {
            id: "m1",
            homeTeamId: "t1",
            awayTeamId: "t2",
            homeGoals: 2,
            awayGoals: 1,
            round: 1,
            scorers: [],
          },
        },
        standings: {},
        transfers: {},
        currentRound: 1,
      },
      ui: {
        standingsSort: "points",
        selectedTeamId: null,
        selectedRound: null,
        playerFilter: {},
      },
    } as unknown as RootState;

    const standings = selectStandings(state);

    // 1. Дві команди в standings
    expect(standings).toHaveLength(2);

    const [first, second] = standings;

    // 2. t1 має 3 очки й іде першою
    expect(first.teamId).toBe("t1");
    expect(first.points).toBe(3);

    // 3. t2 має 0 очок
    expect(second.teamId).toBe("t2");
    expect(second.points).toBe(0);
  });

  test("selectStandings respects standingsSort === 'alphabet'", () => {
    const state = {
      league: {
        teams: {
          t1: { id: "t1", name: "Bravo", budget: 0, players: [] },
          t2: { id: "t2", name: "Alpha", budget: 0, players: [] },
        },
        matches: {},
        standings: {},
        transfers: {},
        currentRound: 1,
      },
      ui: {
        standingsSort: "alphabet",
        selectedTeamId: null,
        selectedRound: null,
        playerFilter: {},
      },
    } as unknown as RootState;

    const standings = selectStandings(state);
    const [first, second] = standings;

    expect(first.teamId).toBe("t2"); // Alpha
    expect(second.teamId).toBe("t1"); // Bravo
  });

  test("selectFilteredPlayers filters by position and price range", () => {
    const state = {
      league: {
        teams: {
          t1: {
            id: "t1",
            name: "Team A",
            budget: 0,
            players: [
              { id: "p1", name: "GK1", position: "GK", price: 1000000 },
              { id: "p2", name: "DF1", position: "DF", price: 2000000 },
              { id: "p3", name: "FW1", position: "FW", price: 3000000 },
            ],
          },
        },
        matches: {},
        standings: {},
        transfers: {},
        currentRound: 1,
      },
      ui: {
        standingsSort: "points",
        selectedTeamId: null,
        selectedRound: null,
        playerFilter: {
          position: "DF",
          minPrice: 1500000,
          maxPrice: 2500000,
        },
      },
    } as unknown as RootState;

    const players = selectFilteredPlayers(state);

    expect(players).toHaveLength(1);
    expect(players[0].id).toBe("p2");
  });
});