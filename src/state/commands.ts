import type { Formation } from '../data/formations';
import type { Phase } from '../logic/phases';
import { movePieces, type Positions } from './actions';
import {
  applyFormation,
  restoreTeam,
  setPhase,
  snapshotTeam,
  type TeamSnapshot,
} from './formationOps';
import type { Command } from './history';
import type { AppState, TeamId } from './schema';

export type AppCommand = Command<AppState>;

export const FORMATION_ANIM_MS = 900;

export function movePiecesCommand(before: Positions, after: Positions): AppCommand {
  return {
    label: 'move',
    apply: (s) => movePieces(s, after),
    revert: (s) => movePieces(s, before),
  };
}

/** Wraps a team-wide transition as before/after team snapshots. */
function teamCommand(
  label: string,
  s: AppState,
  team: TeamId,
  transition: (s: AppState) => AppState,
): AppCommand {
  const before: TeamSnapshot = snapshotTeam(s, team);
  const after: TeamSnapshot = snapshotTeam(transition(s), team);
  return {
    label,
    apply: (st) => restoreTeam(st, after),
    revert: (st) => restoreTeam(st, before),
    meta: { animateMs: FORMATION_ANIM_MS },
  };
}

export function setFormationCommand(s: AppState, team: TeamId, f: Formation): AppCommand {
  return teamCommand('formation', s, team, (st) => applyFormation(st, team, f));
}

export function setPhaseCommand(s: AppState, team: TeamId, phase: Phase): AppCommand {
  return teamCommand('phase', s, team, (st) => setPhase(st, team, phase));
}
