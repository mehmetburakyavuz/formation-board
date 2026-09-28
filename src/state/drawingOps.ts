import type { GroundPoint } from '../core/coords';
import type { InstructionId } from '../data/instructions';
import type { Command } from './history';
import type { Anchor, AppState, Drawing, PieceId } from './schema';

type AppCommand = Command<AppState>;

let counter = 0;
export function newDrawingId(): string {
  counter = (counter + 1) % 1e6;
  return `d-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/** Store position of an anchor (players resolve to their current position). */
export function resolveAnchor(s: AppState, a: Anchor): GroundPoint | null {
  if (a.kind === 'point') return { x: a.x, z: a.z };
  const p = s.players.find((pl) => pl.id === a.id);
  return p ? { x: p.x, z: p.z } : null;
}

function insertAt(list: Drawing[], d: Drawing, index: number): Drawing[] {
  const out = list.filter((x) => x.id !== d.id);
  out.splice(Math.max(0, Math.min(index, out.length)), 0, d);
  return out;
}

function withoutDrawing(s: AppState, id: string): AppState {
  return {
    ...s,
    drawings: s.drawings.filter((d) => d.id !== id),
    selectedDrawing: s.selectedDrawing === id ? null : s.selectedDrawing,
  };
}

export function addDrawingCommand(d: Drawing): AppCommand {
  return {
    label: 'draw',
    apply: (s) => ({ ...s, drawings: insertAt(s.drawings, d, s.drawings.length) }),
    revert: (s) => withoutDrawing(s, d.id),
  };
}

export function removeDrawingCommand(s: AppState, id: string): AppCommand | null {
  const index = s.drawings.findIndex((d) => d.id === id);
  if (index < 0) return null;
  const d = s.drawings[index];
  return {
    label: 'erase',
    apply: (st) => withoutDrawing(st, id),
    // Restore at the same position so draw order is preserved.
    revert: (st) => ({ ...st, drawings: insertAt(st.drawings, d, index) }),
  };
}

function replaceDrawing(s: AppState, d: Drawing): AppState {
  return { ...s, drawings: s.drawings.map((x) => (x.id === d.id ? d : x)) };
}

export function updateDrawingCommand(before: Drawing, after: Drawing): AppCommand {
  return {
    label: 'edit-drawing',
    apply: (s) => replaceDrawing(s, after),
    revert: (s) => replaceDrawing(s, before),
  };
}

export function clearDrawingsCommand(s: AppState): AppCommand | null {
  if (s.drawings.length === 0) return null;
  const all = s.drawings;
  return {
    label: 'clear-drawings',
    apply: (st) => ({ ...st, drawings: [], selectedDrawing: null }),
    revert: (st) => ({ ...st, drawings: all }),
  };
}

export interface InstructionChange {
  id: PieceId;
  before: InstructionId[];
  after: InstructionId[];
}

function setInstructions(s: AppState, changes: InstructionChange[], key: 'before' | 'after') {
  const byId = new Map(changes.map((c) => [c.id, c[key]]));
  return {
    ...s,
    players: s.players.map((p) => {
      const next = byId.get(p.id);
      return next ? { ...p, instructions: next } : p;
    }),
  };
}

/** One undo step for toggling an instruction on several players. */
export function instructionsCommand(changes: InstructionChange[]): AppCommand {
  return {
    label: 'instructions',
    apply: (s) => setInstructions(s, changes, 'after'),
    revert: (s) => setInstructions(s, changes, 'before'),
  };
}
