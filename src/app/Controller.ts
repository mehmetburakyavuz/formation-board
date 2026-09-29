import type { Phase } from '../logic/phases';
import { setActiveTeam, setSelection, toggleSnap } from '../state/actions';
import {
  movePiecesCommand,
  setFormationCommand,
  setPhaseCommand,
  updatePlayerCommand,
  updateTeamCommand,
  type PlayerPatch,
  type TeamPatch,
} from '../state/commands';
import { findFormation, formationFromTeam } from '../state/formationOps';
import { loadDocumentCommand, persistedOf } from '../state/document';
import { matchBoard } from '../state/matchOps';
import type { ImportedTeam } from '../data/matchImport/mapLineup';
import type { History } from '../state/history';
import { createInitialState } from '../state/initialState';
import { saveCustomFormations } from '../state/persistence';
import type { InstructionId } from '../data/instructions';
import {
  newDrawingId,
  addDrawingCommand,
  clearDrawingsCommand,
  instructionsCommand,
  removeDrawingCommand,
  updateDrawingCommand,
  type InstructionChange,
} from '../state/drawingOps';
import type {
  Anchor,
  AppState,
  ArrowStyle,
  Drawing,
  OpponentMode,
  PieceId,
  Settings,
  TeamId,
  ToolId,
  ZoneShape,
} from '../state/schema';
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

  /** Live preview of a team setting (e.g. while a colour picker is open); not recorded. */
  previewTeam(team: TeamId, patch: TeamPatch): void {
    this.store.update((s) => ({
      ...s,
      teams: { ...s.teams, [team]: { ...s.teams[team], ...patch } },
    }));
  }

  /** Records a team settings change as one undo step (`before` = values before editing). */
  commitTeam(team: TeamId, before: TeamPatch, after: TeamPatch): void {
    const same = (Object.keys(after) as (keyof TeamPatch)[]).every((k) => before[k] === after[k]);
    if (same) {
      this.previewTeam(team, after);
      return;
    }
    this.history.execute(updateTeamCommand(team, before, after));
  }

  updatePlayer(id: string, after: PlayerPatch): void {
    const p = this.store.state.players.find((pl) => pl.id === id);
    if (!p) return;
    const before: PlayerPatch = {};
    let changed = false;
    for (const k of Object.keys(after) as (keyof PlayerPatch)[]) {
      Object.assign(before, { [k]: p[k] });
      if (p[k] !== after[k]) changed = true;
    }
    if (changed) this.history.execute(updatePlayerCommand(id, before, after));
  }

  select(ids: PieceId[]): void {
    this.store.update((s) => setSelection(s, ids));
  }

  toggleSnap(): void {
    this.store.update(toggleSnap);
  }

  toggleLabels(): void {
    this.store.update((s) => ({
      ...s,
      settings: { ...s.settings, showLabels: !s.settings.showLabels },
    }));
  }

  setOpponentMode(mode: OpponentMode): void {
    this.store.update((s) => ({ ...s, settings: { ...s.settings, opponentMode: mode } }));
  }

  // --- Tools & drawings ------------------------------------------------------

  setTool(tool: ToolId): void {
    this.store.update((s) =>
      s.tool === tool
        ? s
        : { ...s, tool, selectedDrawing: tool === 'select' ? s.selectedDrawing : null },
    );
  }

  addDrawing(d: Drawing): void {
    this.history.execute(addDrawingCommand(d));
  }

  removeDrawing(id: string): void {
    const cmd = removeDrawingCommand(this.store.state, id);
    if (cmd) this.history.execute(cmd);
  }

  removeSelectedDrawing(): boolean {
    const id = this.store.state.selectedDrawing;
    if (!id) return false;
    this.removeDrawing(id);
    return true;
  }

  clearDrawings(): void {
    const cmd = clearDrawingsCommand(this.store.state);
    if (cmd) this.history.execute(cmd);
  }

  selectDrawing(id: string | null): void {
    this.store.update((s) => (s.selectedDrawing === id ? s : { ...s, selectedDrawing: id }));
  }

  /** Live, unrecorded update while a handle is dragged. */
  previewDrawing(d: Drawing): void {
    this.store.update((s) => ({
      ...s,
      drawings: s.drawings.map((x) => (x.id === d.id ? d : x)),
    }));
  }

  /** Records an already-previewed edit as one undo step. */
  recordDrawingEdit(before: Drawing, after: Drawing): void {
    if (before === after) return;
    this.history.record(updateDrawingCommand(before, after));
  }

  /** Creates a note, or updates/deletes (empty text) an existing one. */
  saveNote(anchor: Anchor, text: string, existingId?: string): void {
    const trimmed = text.trim();
    const s = this.store.state;
    const existing = s.drawings.find((d) => d.id === existingId);
    if (existing?.type === 'note') {
      if (!trimmed) this.removeDrawing(existing.id);
      else if (trimmed !== existing.text) {
        this.history.execute(updateDrawingCommand(existing, { ...existing, text: trimmed }));
      }
      return;
    }
    if (!trimmed) return;
    this.addDrawing({ id: newDrawingId(), type: 'note', anchor, text: trimmed });
  }

  private updateSettings(patch: Partial<Settings>): void {
    this.store.update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }

  setArrowColor(style: ArrowStyle, color: string): void {
    const colors = this.store.state.settings.arrowColors;
    this.updateSettings({ arrowColors: { ...colors, [style]: color } });
  }

  setZoneColor(color: string): void {
    this.updateSettings({ zoneColor: color });
  }

  setZoneShape(shape: ZoneShape): void {
    this.updateSettings({ zoneShape: shape });
  }

  /**
   * Fresh board: teams, players, ball, drawings and scenario back to the defaults.
   * View preferences (labels, snap, colours of the tools…) are kept. One undo step.
   */
  /** Replaces the board with a real match's line-ups (one undo step). */
  importMatch(home: ImportedTeam, away: ImportedTeam): void {
    const before = persistedOf(this.store.state);
    this.history.execute(loadDocumentCommand(before, matchBoard(before, home, away)));
  }

  resetBoard(): void {
    const s = this.store.state;
    const fresh = persistedOf(createInitialState());
    this.history.execute(loadDocumentCommand(persistedOf(s), { ...fresh, settings: s.settings }));
  }

  /**
   * Toggles an instruction on the selected players of the active team: if every selected
   * player has it, it is removed from all, otherwise added to all. One undo step.
   */
  toggleInstruction(instr: InstructionId): void {
    const s = this.store.state;
    const sel = new Set(s.selection);
    const targets = s.players.filter((p) => sel.has(p.id));
    if (targets.length === 0) return;
    const allHave = targets.every((p) => p.instructions.includes(instr));
    const changes: InstructionChange[] = targets.map((p) => ({
      id: p.id,
      before: p.instructions,
      after: allHave
        ? p.instructions.filter((i) => i !== instr)
        : p.instructions.includes(instr)
          ? p.instructions
          : [...p.instructions, instr],
    }));
    this.history.execute(instructionsCommand(changes));
  }

  undo(): void {
    this.history.undo();
  }

  redo(): void {
    this.history.redo();
  }
}
