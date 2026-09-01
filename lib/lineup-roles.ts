export type Role = "G" | "F" | "C";
export const lineupSlots: Role[] = ["G", "G", "F", "F", "C"];
export function roles(position?: string): Role[] {
  return (position || "")
    .toUpperCase()
    .split(/[-/\s]+/)
    .filter((p): p is Role => ["G", "F", "C"].includes(p));
}
// Backtracking handles multi-position players without counting anyone twice.
export function assignLineup<T extends { id: number; position?: string }>(
  players: T[],
): T[] | null {
  if (players.length !== 5 || new Set(players.map((p) => p.id)).size !== 5)
    return null;
  function visit(slot: number, used: Set<number>): T[] | null {
    if (slot === 5) return [];
    for (const p of players)
      if (!used.has(p.id) && roles(p.position).includes(lineupSlots[slot])) {
        const tail = visit(slot + 1, new Set([...Array.from(used), p.id]));
        if (tail) return [p, ...tail];
      }
    return null;
  }
  return visit(0, new Set());
}
export function pickLegalFive<T extends { id: number; position?: string }>(
  pool: T[],
): T[] {
  function visit(slot: number, used: Set<number>): T[] | null {
    if (slot === 5) return [];
    for (const p of pool)
      if (!used.has(p.id) && roles(p.position).includes(lineupSlots[slot])) {
        const tail = visit(slot + 1, new Set([...Array.from(used), p.id]));
        if (tail) return [p, ...tail];
      }
    return null;
  }
  return visit(0, new Set()) || [];
}
