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
import type { AppState, PlayerState, TeamId, TeamState } from './schema';

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

export type TeamPatch = Partial<Pick<TeamState, 'name' | 'color' | 'numberColor' | 'gkColor'>>;

function patchTeam(s: AppState, team: TeamId, patch: TeamPatch): AppState {
  return { ...s, teams: { ...s.teams, [team]: { ...s.teams[team], ...patch } } };
}

export function updateTeamCommand(team: TeamId, before: TeamPatch, after: TeamPatch): AppCommand {
  return {
    label: 'team',
    apply: (s) => patchTeam(s, team, after),
    revert: (s) => patchTeam(s, team, before),
  };
}

export type PlayerPatch = Partial<Pick<PlayerState, 'name' | 'number' | 'instructions'>>;

function patchPlayer(s: AppState, id: string, patch: PlayerPatch): AppState {
  return { ...s, players: s.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

export function updatePlayerCommand(
  id: string,
  before: PlayerPatch,
  after: PlayerPatch,
): AppCommand {
  return {
    label: 'player',
    apply: (s) => patchPlayer(s, id, after),
    revert: (s) => patchPlayer(s, id, before),
  };
}
