export function generatePairings(teamIds: string[]): [string, string][] {
  // Найпростіший варіант: беремо послідовно парами
  const pairings: [string, string][] = [];
  for (let i = 0; i < teamIds.length; i += 2) {
    const homeId = teamIds[i];
    const awayId = teamIds[i + 1];
    if (!awayId) break; // непарна кількість команд - остання не грає
    pairings.push([homeId, awayId]);
  }
  return pairings;
}

export function randomScore(): { homeGoals: number; awayGoals: number } {
  const homeGoals = Math.floor(Math.random() * 4); // 0-3
  const awayGoals = Math.floor(Math.random() * 4);
  return { homeGoals, awayGoals };
}