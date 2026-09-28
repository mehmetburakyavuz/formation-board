import type { FormationSlot, Role } from '../data/formations';

export type Line = 'GK' | 'DEF' | 'MID' | 'ATT';

const LINES: Record<Role, Line> = {
  GK: 'GK',
  LB: 'DEF',
  LCB: 'DEF',
  CB: 'DEF',
  RCB: 'DEF',
  RB: 'DEF',
  LWB: 'DEF',
  RWB: 'DEF',
  CDM: 'MID',
  LDM: 'MID',
  RDM: 'MID',
  LCM: 'MID',
  CM: 'MID',
  RCM: 'MID',
  LM: 'MID',
  RM: 'MID',
  LAM: 'MID',
  CAM: 'MID',
  RAM: 'MID',
  LW: 'ATT',
  RW: 'ATT',
  LS: 'ATT',
  ST: 'ATT',
  RS: 'ATT',
};

export function roleLine(role: Role): Line {
  return LINES[role];
}

export interface SlotCandidate {
  id: string;
  role: Role;
  /** Current normalized position of the player. */
  nx: number;
  ny: number;
}

/** Tier: 0 same role, 1 same line, 2 different line, 3 goalkeeper ↔ outfield (avoid). */
function tier(a: Role, b: Role): number {
  if (a === b) return 0;
  const la = roleLine(a);
  const lb = roleLine(b);
  if (la === 'GK' || lb === 'GK') return 3;
  return la === lb ? 1 : 2;
}

/** Tier weight dominates any possible sum of distances (11 × √2 < 100). */
const TIER_WEIGHT = 100;

function pairCost(pl: SlotCandidate, sl: FormationSlot): number {
  return tier(pl.role, sl.role) * TIER_WEIGHT + Math.hypot(pl.nx - sl.nx, pl.ny - sl.ny);
}

/**
 * Player → slot matching. Priority: same role > same line > nearest distance.
 * A greedy pass (cheapest pairs first) is followed by pairwise swaps that lower the
 * total cost, which removes greedy artefacts such as a winger crossing the pitch
 * because of a tie. Returns a map from player id to slot index. Pure and deterministic.
 */
export function assignSlots(
  players: readonly SlotCandidate[],
  slots: readonly FormationSlot[],
): Map<string, number> {
  const cost = players.map((pl) => slots.map((sl) => pairCost(pl, sl)));

  // Greedy.
  const pairs: { p: number; s: number }[] = [];
  players.forEach((_, p) => slots.forEach((_s, s) => pairs.push({ p, s })));
  pairs.sort((a, b) => cost[a.p][a.s] - cost[b.p][b.s] || a.p - b.p || a.s - b.s);
  const slotOf: number[] = players.map(() => -1);
  const usedSlots = new Set<number>();
  for (const { p, s } of pairs) {
    if (slotOf[p] !== -1 || usedSlots.has(s)) continue;
    slotOf[p] = s;
    usedSlots.add(s);
  }

  // Local improvement: swap two players' slots while it strictly lowers the cost.
  const EPS = 1e-9;
  for (let pass = 0, improved = true; improved && pass < 50; pass++) {
    improved = false;
    for (let a = 0; a < players.length; a++) {
      for (let b = a + 1; b < players.length; b++) {
        const sa = slotOf[a];
        const sb = slotOf[b];
        if (sa === -1 || sb === -1) continue;
        const now = cost[a][sa] + cost[b][sb];
        const swapped = cost[a][sb] + cost[b][sa];
        if (swapped < now - EPS) {
          slotOf[a] = sb;
          slotOf[b] = sa;
          improved = true;
        }
      }
    }
  }

  const result = new Map<string, number>();
  players.forEach((pl, p) => {
    if (slotOf[p] !== -1) result.set(pl.id, slotOf[p]);
  });
  return result;
}
