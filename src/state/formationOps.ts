import { normalizedToWorld, worldToNormalized, type GroundPoint } from '../core/coords';
import { FORMATIONS, type Formation, type FormationSlot } from '../data/formations';
import { assignSlots } from '../logic/assignSlots';
import { deriveDefence, type Phase } from '../logic/phases';
import type { AppState, PlayerState, TeamId } from './schema';

export function allFormations(s: AppState): Formation[] {
  return [...FORMATIONS, ...s.customFormations];
}

export function findFormation(s: AppState, id: string): Formation | undefined {
  return allFormations(s).find((f) => f.id === id);
}

/** World positions for both phases of a formation slot. */
export function slotLayouts(slot: FormationSlot, team: TeamId): Record<Phase, GroundPoint> {
  return {
    attack: normalizedToWorld(slot, team),
    defence: normalizedToWorld(deriveDefence(slot, slot.role), team),
  };
}

/**
 * Re-arranges a team into `formation`. Players keep their identity (number, name, instructions)
 * and are matched to slots by role/line/distance. Both phase layouts are reset.
 */
export function applyFormation(s: AppState, team: TeamId, formation: Formation): AppState {
  const teamState = s.teams[team];
  const squad = s.players.filter((p) => p.team === team);
  const candidates = squad.map((p) => ({
    id: p.id,
    role: p.role,
    ...worldToNormalized(p.layouts.attack, team),
  }));
  const assignment = assignSlots(candidates, formation.slots);

  const players = s.players.map((p): PlayerState => {
    if (p.team !== team) return p;
    const slotIndex = assignment.get(p.id);
    if (slotIndex === undefined) return p;
    const slot = formation.slots[slotIndex];
    const layouts = slotLayouts(slot, team);
    const cur = layouts[teamState.phase];
    return { ...p, role: slot.role, layouts, x: cur.x, z: cur.z };
  });
  return {
    ...s,
    players,
    teams: { ...s.teams, [team]: { ...teamState, formationId: formation.id } },
  };
}

/** Switches a team between its attacking and defensive layouts. */
export function setPhase(s: AppState, team: TeamId, phase: Phase): AppState {
  const teamState = s.teams[team];
  if (teamState.phase === phase) return s;
  const players = s.players.map((p) => {
    if (p.team !== team) return p;
    const pos = p.layouts[phase];
    return { ...p, x: pos.x, z: pos.z };
  });
  return { ...s, players, teams: { ...s.teams, [team]: { ...teamState, phase } } };
}

/** Captures a team's attacking layout as a reusable formation (goalkeeper first). */
export function formationFromTeam(s: AppState, team: TeamId, id: string, name: string): Formation {
  const squad = s.players.filter((p) => p.team === team);
  const sorted = [...squad].sort((a, b) => Number(b.role === 'GK') - Number(a.role === 'GK'));
  const slots = sorted.map((p) => {
    const n = worldToNormalized(p.layouts.attack, team);
    return {
      role: p.role,
      nx: Math.round(n.nx * 1000) / 1000,
      ny: Math.round(n.ny * 1000) / 1000,
    };
  });
  return { id, name, slots };
}

/** Team-scoped snapshot used by undoable team-wide commands. */
export interface TeamSnapshot {
  team: TeamId;
  formationId: string;
  phase: Phase;
  players: PlayerState[];
}

export function snapshotTeam(s: AppState, team: TeamId): TeamSnapshot {
  const t = s.teams[team];
  return {
    team,
    formationId: t.formationId,
    phase: t.phase,
    players: s.players.filter((p) => p.team === team),
  };
}

export function restoreTeam(s: AppState, snap: TeamSnapshot): AppState {
  const byId = new Map(snap.players.map((p) => [p.id, p]));
  const t = s.teams[snap.team];
  return {
    ...s,
    players: s.players.map((p) => byId.get(p.id) ?? p),
    teams: {
      ...s.teams,
      [snap.team]: { ...t, formationId: snap.formationId, phase: snap.phase },
    },
  };
}
