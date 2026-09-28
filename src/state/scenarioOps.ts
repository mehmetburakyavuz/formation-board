import type { GroundPoint } from '../core/coords';
import type { Command } from './history';
import type { AppState, BallState, Drawing, Keyframe, PieceId, PlayerState } from './schema';

type AppCommand = Command<AppState>;

export const DEFAULT_FRAME_MS = 1200;
export const MIN_FRAME_MS = 300;
export const MAX_FRAME_MS = 5000;

let counter = 0;
export function newFrameId(): string {
  counter = (counter + 1) % 1e6;
  return `f-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function captureFrame(s: AppState, id: string, duration = DEFAULT_FRAME_MS): Keyframe {
  const players: Record<PieceId, GroundPoint> = {};
  for (const p of s.players) players[p.id] = { x: p.x, z: p.z };
  return { id, players, ball: { ...s.ball }, drawings: s.drawings, duration };
}

/** Puts the board into a frame's state (positions edit each team's current phase layout). */
export function applyFrame(s: AppState, f: Keyframe): AppState {
  const players = s.players.map((p) => {
    const pos = f.players[p.id];
    if (!pos) return p;
    const phase = s.teams[p.team].phase;
    return { ...p, x: pos.x, z: pos.z, layouts: { ...p.layouts, [phase]: { ...pos } } };
  });
  return {
    ...s,
    players,
    ball: { ...f.ball },
    drawings: f.drawings,
    selectedDrawing: null,
    scenario: { ...s.scenario, current: f.id },
  };
}

// --- Frame list commands ---------------------------------------------------------

function setFrames(s: AppState, frames: Keyframe[], current = s.scenario.current): AppState {
  return { ...s, scenario: { ...s.scenario, frames, current } };
}

export function addFrameCommand(f: Keyframe, index: number): AppCommand {
  return {
    label: 'frame-add',
    apply: (s) => {
      const frames = [...s.scenario.frames];
      frames.splice(index, 0, f);
      return setFrames(s, frames, f.id);
    },
    revert: (s) =>
      setFrames(
        s,
        s.scenario.frames.filter((x) => x.id !== f.id),
        s.scenario.current === f.id ? null : s.scenario.current,
      ),
  };
}

export function removeFrameCommand(s: AppState, id: string): AppCommand | null {
  const index = s.scenario.frames.findIndex((f) => f.id === id);
  if (index < 0) return null;
  const f = s.scenario.frames[index];
  const wasCurrent = s.scenario.current === id;
  return {
    label: 'frame-remove',
    apply: (st) =>
      setFrames(
        st,
        st.scenario.frames.filter((x) => x.id !== id),
        st.scenario.current === id ? null : st.scenario.current,
      ),
    revert: (st) => {
      const frames = [...st.scenario.frames];
      frames.splice(index, 0, f);
      return setFrames(st, frames, wasCurrent ? id : st.scenario.current);
    },
  };
}

function move<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

export function moveFrameCommand(from: number, to: number): AppCommand {
  return {
    label: 'frame-move',
    apply: (s) => setFrames(s, move(s.scenario.frames, from, to)),
    revert: (s) => setFrames(s, move(s.scenario.frames, to, from)),
  };
}

export function replaceFrameCommand(before: Keyframe, after: Keyframe): AppCommand {
  const swap = (s: AppState, f: Keyframe) =>
    setFrames(
      s,
      s.scenario.frames.map((x) => (x.id === f.id ? f : x)),
    );
  return {
    label: 'frame-edit',
    apply: (s) => swap(s, after),
    revert: (s) => swap(s, before),
  };
}

// --- Board snapshots (go-to-frame / playback as one undo step) ---------------------

export interface BoardDoc {
  players: PlayerState[];
  ball: BallState;
  drawings: Drawing[];
  current: string | null;
}

export function boardDoc(s: AppState): BoardDoc {
  return { players: s.players, ball: s.ball, drawings: s.drawings, current: s.scenario.current };
}

function restoreBoard(s: AppState, d: BoardDoc): AppState {
  return {
    ...s,
    players: d.players,
    ball: d.ball,
    drawings: d.drawings,
    selectedDrawing: null,
    scenario: { ...s.scenario, current: d.current },
  };
}

export function boardCommand(before: BoardDoc, after: BoardDoc): AppCommand {
  return {
    label: 'board',
    apply: (s) => restoreBoard(s, after),
    revert: (s) => restoreBoard(s, before),
  };
}
