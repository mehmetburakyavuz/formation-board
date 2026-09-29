import { assignSlots } from '../../logic/assignSlots';
import { getFormation, type FormationSlot, type Role } from '../formations';
import type { ApiLineup, ApiLineupPlayer } from './apiClient';

/**
 * API-Football numbers grid columns across the pitch; true = column 1 is the team's left
 * (left back side). Flip this if imported full-backs/wingers end up on the wrong flank.
 */
const COLUMN_1_IS_LEFT = true;

export interface ImportedPlayer extends FormationSlot {
  name: string;
  number: number;
}

export interface ImportedTeam {
  name: string;
  /** Formation string from the API, e.g. "4-2-3-1" (matches a built-in id when known). */
  formationId: string;
  /** 11 players, goalkeeper first. */
  players: ImportedPlayer[];
}

export class LineupError extends Error {}

interface GridPlayer {
  player: ApiLineupPlayer;
  row: number;
  col: number;
}

function parseGrid(grid: string | null): { row: number; col: number } | null {
  const m = grid ? /^(\d+):(\d+)$/.exec(grid) : null;
  return m ? { row: Number(m[1]), col: Number(m[2]) } : null;
}

function parseFormation(f: string | null): number[] | null {
  if (!f || !/^\d(-\d)+$/.test(f)) return null;
  const lines = f.split('-').map(Number);
  return lines.reduce((a, b) => a + b, 0) === 10 ? lines : null;
}

/** Grid rows, or rows rebuilt from the formation string + list order when grids are missing. */
function gridPlayers(lineup: ApiLineup): GridPlayer[] {
  const xi = lineup.startXI.map((e) => e.player);
  const gridded = xi.flatMap((player) => {
    const g = parseGrid(player.grid);
    return g ? [{ player, ...g }] : [];
  });
  const keys = new Set(gridded.map((g) => `${g.row}:${g.col}`));
  if (gridded.length === xi.length && keys.size === xi.length) return gridded;
  const lines = parseFormation(lineup.formation);
  if (!lines) throw new LineupError('noFormation');
  const gk = xi.findIndex((p) => p.pos === 'G');
  const ordered = gk > 0 ? [xi[gk], ...xi.filter((_, i) => i !== gk)] : xi;
  const rows = [1, ...lines];
  const out: GridPlayer[] = [];
  let i = 0;
  rows.forEach((n, r) => {
    for (let c = 1; c <= n; c++) out.push({ player: ordered[i++], row: r + 1, col: c });
  });
  return out;
}

type LineKind = 'def' | 'dm' | 'cm' | 'am' | 'att';

/** Roles for a line of `n` players, left to right. */
function lineRoles(kind: LineKind, n: number, backThree: boolean): Role[] | null {
  const wideMid: [Role, Role] = backThree ? ['LWB', 'RWB'] : ['LM', 'RM'];
  const table: Record<LineKind, Record<number, Role[]>> = {
    def: {
      1: ['CB'],
      2: ['LCB', 'RCB'],
      3: ['LCB', 'CB', 'RCB'],
      4: ['LB', 'LCB', 'RCB', 'RB'],
      5: ['LWB', 'LCB', 'CB', 'RCB', 'RWB'],
    },
    dm: {
      1: ['CDM'],
      2: ['LDM', 'RDM'],
      3: ['LDM', 'CDM', 'RDM'],
    },
    cm: {
      1: ['CM'],
      2: ['LCM', 'RCM'],
      3: ['LCM', 'CM', 'RCM'],
      4: [wideMid[0], 'LCM', 'RCM', wideMid[1]],
      5: [wideMid[0], 'LCM', 'CM', 'RCM', wideMid[1]],
    },
    am: {
      1: ['CAM'],
      2: ['LAM', 'RAM'],
      3: ['LAM', 'CAM', 'RAM'],
    },
    att: {
      1: ['ST'],
      2: ['LS', 'RS'],
      3: ['LW', 'ST', 'RW'],
      4: ['LW', 'LS', 'RS', 'RW'],
    },
  };
  return table[kind][n] ?? null;
}

const FALLBACK: Record<LineKind, [Role, Role, Role]> = {
  def: ['LB', 'CB', 'RB'],
  dm: ['LDM', 'CDM', 'RDM'],
  cm: ['LM', 'CM', 'RM'],
  am: ['LAM', 'CAM', 'RAM'],
  att: ['LW', 'ST', 'RW'],
};

/** Kind of each outfield line, from the back. Wide 4-5 player midfield lines stay 'cm'. */
function lineKinds(sizes: number[]): LineKind[] {
  const mids = sizes.slice(1, -1);
  const midKinds: LineKind[] =
    mids.length === 1
      ? ['cm']
      : mids.map((n, i) => {
          if (n >= 4) return 'cm';
          if (i === 0) return 'dm';
          return i === mids.length - 1 ? 'am' : 'cm';
        });
  return ['def', ...midKinds, 'att'];
}

/** Horizontal spread (fraction of pitch width) of a line with `n` players. */
const SPREAD = [0, 0, 0.24, 0.46, 0.76, 0.84];

/** "K. De Bruyne" → "De Bruyne"; long multi-word names keep only the surname. */
export function shortName(full: string): string {
  const name = full.replace(/^(\p{L}\.\s*)+/u, '').trim() || full.trim();
  const words = name.split(/\s+/);
  const short = name.length > 14 && words.length > 1 ? words[words.length - 1] : name;
  return short.slice(0, 40);
}

/** API line-up → 11 positioned players with roles. Throws `LineupError` if unusable. */
export function mapLineup(lineup: ApiLineup): ImportedTeam {
  if (lineup.startXI.length !== 11) throw new LineupError('incomplete');
  const players = gridPlayers(lineup);
  const rows = [...new Set(players.map((p) => p.row))].sort((a, b) => a - b);
  const byRow = rows.map((r) =>
    players
      .filter((p) => p.row === r)
      .sort((a, b) => (COLUMN_1_IS_LEFT ? a.col - b.col : b.col - a.col)),
  );
  if (byRow[0].length !== 1 || byRow.length < 3) throw new LineupError('noFormation');

  const outfield = byRow.slice(1);
  const sizes = outfield.map((l) => l.length);
  const kinds = lineKinds(sizes);
  const backThree = sizes[0] === 3;
  const formationId =
    lineup.formation && parseFormation(lineup.formation) ? lineup.formation : sizes.join('-');

  const toPlayer = (g: GridPlayer, role: Role, nx: number, ny: number): ImportedPlayer => ({
    role,
    nx,
    ny,
    name: shortName(g.player.name),
    number: g.player.number ?? 0,
  });

  const result: ImportedPlayer[] = [toPlayer(byRow[0][0], 'GK', 0.05, 0.5)];
  outfield.forEach((line, k) => {
    const n = line.length;
    const nx = 0.22 + (k * 0.46) / (outfield.length - 1);
    const spread = SPREAD[Math.min(n, SPREAD.length - 1)];
    const roles = lineRoles(kinds[k], n, backThree);
    line.forEach((g, c) => {
      const t = n === 1 ? 0.5 : c / (n - 1);
      const [l, m, r] = FALLBACK[kinds[k]];
      const role = roles?.[c] ?? (t < 0.3 ? l : t > 0.7 ? r : m);
      result.push(toPlayer(g, role, nx, 0.5 + (t - 0.5) * spread));
    });
  });

  return { name: lineup.team.name, formationId, players: snapToBuiltIn(formationId, result) };
}

/** Known formations use the hand-tuned built-in slot positions and roles. */
function snapToBuiltIn(formationId: string, players: ImportedPlayer[]): ImportedPlayer[] {
  const f = getFormation(formationId);
  if (!f) return players;
  const assignment = assignSlots(
    players.map((p, i) => ({ id: String(i), role: p.role, nx: p.nx, ny: p.ny })),
    f.slots,
  );
  return players.map((p, i) => ({ ...p, ...f.slots[assignment.get(String(i)) ?? i] }));
}
