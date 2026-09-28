import type { Command } from './history';
import { SCHEMA_VERSION, type AppState, type PersistedState, type TacticDocument } from './schema';

export function persistedOf(s: AppState): PersistedState {
  return {
    tacticName: s.tacticName,
    teams: s.teams,
    players: s.players,
    ball: s.ball,
    activeTeam: s.activeTeam,
    settings: s.settings,
    drawings: s.drawings,
    scenario: s.scenario,
  };
}

export function toDocument(s: AppState, now = new Date()): TacticDocument {
  return { version: SCHEMA_VERSION, savedAt: now.toISOString(), state: persistedOf(s) };
}

/** Replaces the board with persisted content; transient UI state is reset. */
export function withPersisted(s: AppState, p: PersistedState): AppState {
  return { ...s, ...p, selection: [], selectedDrawing: null };
}

/** True if any persisted part differs (by reference; state is immutable). */
export function persistedChanged(a: AppState, b: AppState): boolean {
  return (
    a.tacticName !== b.tacticName ||
    a.teams !== b.teams ||
    a.players !== b.players ||
    a.ball !== b.ball ||
    a.activeTeam !== b.activeTeam ||
    a.settings !== b.settings ||
    a.drawings !== b.drawings ||
    a.scenario !== b.scenario
  );
}

/** Loading a tactic is undoable, so an accidental load never loses the board. */
export function loadDocumentCommand(
  before: PersistedState,
  after: PersistedState,
): Command<AppState> {
  return {
    label: 'load',
    apply: (s) => withPersisted(s, after),
    revert: (s) => withPersisted(s, before),
    meta: { animateMs: 700 },
  };
}
