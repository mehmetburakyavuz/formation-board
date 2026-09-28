import { BALL_ID, type AppState, type PieceId, type TeamId } from './schema';
import type { GroundPoint } from '../core/coords';

export type Positions = ReadonlyMap<PieceId, GroundPoint>;

/** Pure state transitions. Undoable ones are wrapped into history commands (see commands.ts). */
export function movePieces(s: AppState, positions: Positions): AppState {
  if (positions.size === 0) return s;
  const players = s.players.map((p) => {
    const np = positions.get(p.id);
    if (!np || (np.x === p.x && np.z === p.z)) return p;
    // Manual moves edit the layout of the team's current phase only.
    const phase = s.teams[p.team].phase;
    const layouts = { ...p.layouts, [phase]: { x: np.x, z: np.z } };
    return { ...p, x: np.x, z: np.z, layouts };
  });
  const b = positions.get(BALL_ID);
  const ball = b ? { x: b.x, z: b.z } : s.ball;
  return { ...s, players, ball };
}

export function setSelection(s: AppState, selection: PieceId[]): AppState {
  const same =
    selection.length === s.selection.length && selection.every((id, i) => s.selection[i] === id);
  return same ? s : { ...s, selection };
}

export function setActiveTeam(s: AppState, team: TeamId): AppState {
  if (s.activeTeam === team) return s;
  // Selection of the now-locked team is dropped; the ball stays selectable.
  const selection = s.selection.filter(
    (id) => id === BALL_ID || s.players.find((p) => p.id === id)?.team === team,
  );
  return { ...s, activeTeam: team, selection };
}

export function toggleSnap(s: AppState): AppState {
  return { ...s, settings: { ...s.settings, snap: !s.settings.snap } };
}

export function getPiecePosition(s: AppState, id: PieceId): GroundPoint | undefined {
  if (id === BALL_ID) return s.ball;
  const p = s.players.find((pl) => pl.id === id);
  return p ? { x: p.x, z: p.z } : undefined;
}

/** Pieces the user may currently select/drag: active team players plus the ball. */
export function isInteractive(s: AppState, id: PieceId): boolean {
  if (id === BALL_ID) return true;
  return s.players.find((p) => p.id === id)?.team === s.activeTeam;
}
