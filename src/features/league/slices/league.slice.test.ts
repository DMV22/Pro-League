import leagueReducer, {
  initialState,
  simulateMatchday,
  transferPlayer,
} from "./league.slice";

describe("League Reducers", () => {
  // Допоміжна функція для отримання свіжого стану перед кожним тестом
  const getFreshState = () => structuredClone(initialState);

  test("transferPlayer moves player and updates budgets", () => {
    const state = getFreshState();

    const fromTeamId = "t1";
    const toTeamId = "t2";
    const fromTeam = state.teams[fromTeamId];
    const toTeam = state.teams[toTeamId];

    // Беремо першого гравця для тесту
    const playerToTransfer = fromTeam.players[0].id;
    const fee = 5_000_000;

    const action = transferPlayer({
      id: "tx_123",
      fromTeamId,
      toTeamId,
      playerId: playerToTransfer,
      fee,
      date: "2026-08-14"
    });

    const nextState = leagueReducer(state, action);

    const nextFrom = nextState.teams[fromTeam.id];
    const nextTo = nextState.teams[toTeam.id];

    // 1. Гравець видалений з fromTeam
    expect(nextFrom.players.some((p) => p.id === playerToTransfer)).toBe(false);

    // 2. Гравець доданий до toTeam
    expect(nextTo.players.some((p) => p.id === playerToTransfer)).toBe(true);

    // 3. Бюджети оновлені
    expect(nextFrom.budget).toBe(fromTeam.budget + fee);
    expect(nextTo.budget).toBe(toTeam.budget - fee);
  });

  test("transferPlayer does nothing if toTeam has insufficient budget", () => {
    const state = getFreshState();
    const fromTeam = state.teams["t1"];
    const toTeam = state.teams["t2"];
    const playerId = fromTeam.players[0].id;

    const hugeFee = toTeam.budget + 1;

    const action = transferPlayer({
      id: "tx_123",
      playerId,
      fromTeamId: fromTeam.id,
      toTeamId: toTeam.id,
      fee: hugeFee,
      date: "2026-08-14"
    });

    const nextState = leagueReducer(state, action);

    // Бюджети й склади не мають змінитися
    expect(nextState.teams[fromTeam.id]).toEqual(fromTeam);
    expect(nextState.teams[toTeam.id]).toEqual(toTeam);
  });

  test("simulateMatchday creates matches and increments currentRound", () => {
    const state = getFreshState();
    const initialRound = state.currentRound;

    const action = simulateMatchday();
    const nextState = leagueReducer(state, action);

    const matches = Object.values(nextState.matches);

    // 1. Має зʼявитись принаймні один матч (якщо >=2 команд)
    expect(matches.length).toBeGreaterThan(0);

    // 2. Всі матчі повинні мати round === initialRound
    matches.forEach((m) => { expect(m.round).toBe(initialRound) });

    // 3. currentRound збільшився на 1
    expect(nextState.currentRound).toBe(initialRound + 1);
  });
});
