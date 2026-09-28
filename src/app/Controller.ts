import type { Phase } from '../logic/phases';
import { setActiveTeam } from '../state/actions';
import { movePiecesCommand, setFormationCommand, setPhaseCommand } from '../state/commands';
import { findFormation, formationFromTeam } from '../state/formationOps';
import type { History } from '../state/history';
import { saveCustomFormations } from '../state/persistence';
import type { AppState, TeamId } from '../state/schema';
import type { Store } from '../state/store';
import type { Positions } from '../state/actions';

/**
 * User intents → store/history. UI and interaction code call this instead of
 * mutating state, so every undoable action goes through the history.
 */
export class Controller {
  constructor(
    readonly store: Store<AppState>,
    readonly history: History<AppState>,
  ) {}

  get state(): AppState {
    return this.store.state;
  }

  setFormation(team: TeamId, formationId: string): void {
    const s = this.store.state;
    const f = findFormation(s, formationId);
    if (!f) return;
    this.history.execute(setFormationCommand(s, team, f));
  }

  setPhase(team: TeamId, phase: Phase): void {
    const s = this.store.state;
    if (s.teams[team].phase === phase) return;
    this.history.execute(setPhaseCommand(s, team, phase));
  }

  togglePhase(team: TeamId): void {
    this.setPhase(team, this.store.state.teams[team].phase === 'attack' ? 'defence' : 'attack');
  }

  /** Records a finished drag (already applied) as one undo step. */
  recordMove(before: Positions, after: Positions): void {
    this.history.record(movePiecesCommand(before, after));
  }

  setActiveTeam(team: TeamId): void {
    this.store.update((s) => setActiveTeam(s, team));
  }

  toggleActiveTeam(): void {
    this.setActiveTeam(this.store.state.activeTeam === 'home' ? 'away' : 'home');
  }

  /** Saves the team's current attacking shape as a named custom formation. */
  saveCustomFormation(team: TeamId, name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = `custom-${Date.now().toString(36)}`;
    const s = this.store.state;
    const f = formationFromTeam(s, team, id, trimmed);
    const customFormations = [...s.customFormations, f];
    saveCustomFormations(customFormations);
    this.store.set({
      ...s,
      customFormations,
      teams: { ...s.teams, [team]: { ...s.teams[team], formationId: id } },
    });
  }

  deleteCustomFormation(id: string): void {
    const s = this.store.state;
    const customFormations = s.customFormations.filter((f) => f.id !== id);
    saveCustomFormations(customFormations);
    this.store.set({ ...s, customFormations });
  }

  undo(): void {
    this.history.undo();
  }

  redo(): void {
    this.history.redo();
  }
}
