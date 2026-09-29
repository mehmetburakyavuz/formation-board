import { clampToPitch, HALF_LENGTH, HALF_WIDTH, type GroundPoint } from '../core/coords';
import { separate } from '../logic/separate';
import { getPiecePosition, movePieces, type Positions } from '../state/actions';
import { BALL_ID, type AppState, type PieceId } from '../state/schema';
import type { Store } from '../state/store';
import type { DragGuides } from '../scene/DragGuides';
import type { PiecesView } from '../scene/PiecesView';
import { PIECE_SCALE } from '../scene/playerGeometry';
import { DRAG_MARGIN, SNAP_STEP } from '../scene/SnapGrid';
import type { Picker } from './Picker';

/** Enlarged pieces need more room so their figures and rings do not overlap. */
const MIN_PLAYER_DISTANCE = 0.8 * PIECE_SCALE;

export interface DragCommit {
  before: Positions;
  after: Positions;
}

interface DragSession {
  pointerId: number;
  grabbed: PieceId;
  ids: PieceId[];
  starts: Map<PieceId, GroundPoint>;
  origin: GroundPoint;
  moved: boolean;
}

interface ControlsLike {
  enabled: boolean;
}

/** Moves one or more pieces along the ground plane, keeping the grab offset. */
export class DragController {
  private session: DragSession | null = null;
  /** Called once per finished drag (one undo step in M3). */
  onCommit: ((c: DragCommit) => void) | null = null;

  constructor(
    private store: Store<AppState>,
    private picker: Picker,
    private view: PiecesView,
    private guides: DragGuides,
    private controls: ControlsLike,
  ) {}

  get active(): boolean {
    return this.session !== null;
  }

  get pointerId(): number | null {
    return this.session?.pointerId ?? null;
  }

  begin(e: PointerEvent, grabbed: PieceId, ids: PieceId[]): boolean {
    const origin = this.picker.ground(e);
    if (!origin) return false;
    const s = this.store.state;
    const starts = new Map<PieceId, GroundPoint>();
    for (const id of ids) {
      const p = getPiecePosition(s, id);
      if (p) starts.set(id, { x: p.x, z: p.z });
    }
    if (!starts.has(grabbed)) return false;
    // Grabbed piece first so its guide carries the distance label.
    const ordered = [grabbed, ...[...starts.keys()].filter((id) => id !== grabbed)];
    this.session = { pointerId: e.pointerId, grabbed, ids: ordered, starts, origin, moved: false };
    this.controls.enabled = false;
    this.view.setLifted(ordered, true);
    return true;
  }

  move(e: PointerEvent): void {
    const ses = this.session;
    if (!ses || e.pointerId !== ses.pointerId) return;
    const g = this.picker.ground(e);
    if (!g) return;
    let dx = g.x - ses.origin.x;
    let dz = g.z - ses.origin.z;

    const grabStart = ses.starts.get(ses.grabbed);
    if (grabStart && this.store.state.settings.snap) {
      dx = Math.round((grabStart.x + dx) / SNAP_STEP) * SNAP_STEP - grabStart.x;
      dz = Math.round((grabStart.z + dz) / SNAP_STEP) * SNAP_STEP - grabStart.z;
    }
    [dx, dz] = this.clampGroupDelta(ses, dx, dz);
    if (Math.abs(dx) > 1e-4 || Math.abs(dz) > 1e-4) ses.moved = true;

    const positions = new Map<PieceId, GroundPoint>();
    for (const [id, st] of ses.starts) positions.set(id, { x: st.x + dx, z: st.z + dz });
    this.store.update((s) => movePieces(s, positions));
    this.guides.show(
      ses.ids.map((id) => {
        const from = ses.starts.get(id) ?? { x: 0, z: 0 };
        return { from, to: positions.get(id) ?? from };
      }),
    );
  }

  /** Limit the delta so the whole group stays within pitch + margin (keeps its shape). */
  private clampGroupDelta(ses: DragSession, dx: number, dz: number): [number, number] {
    const mx = HALF_LENGTH + DRAG_MARGIN;
    const mz = HALF_WIDTH + DRAG_MARGIN;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of ses.starts.values()) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const cx = Math.min(mx - maxX, Math.max(-mx - minX, dx));
    const cz = Math.min(mz - maxZ, Math.max(-mz - minZ, dz));
    return [cx, cz];
  }

  end(e: PointerEvent): void {
    const ses = this.session;
    if (!ses || e.pointerId !== ses.pointerId) return;
    this.finish(ses, true);
  }

  cancel(): void {
    const ses = this.session;
    if (!ses) return;
    // Restore start positions.
    this.store.update((s) => movePieces(s, ses.starts));
    this.finish(ses, false);
  }

  private finish(ses: DragSession, commit: boolean): void {
    this.session = null;
    this.controls.enabled = true;
    this.view.setLifted(ses.ids, false);
    this.guides.hide();
    if (!commit || !ses.moved) return;

    const s = this.store.state;
    const moved = new Map<PieceId, GroundPoint>();
    for (const id of ses.ids) {
      if (id === BALL_ID) continue;
      const p = getPiecePosition(s, id);
      if (p) moved.set(id, p);
    }
    const separated = separate(moved, s.players, MIN_PLAYER_DISTANCE);
    const after = new Map<PieceId, GroundPoint>();
    for (const id of ses.ids) {
      const p = separated.get(id) ?? getPiecePosition(s, id);
      if (p) after.set(id, clampToPitch(p, DRAG_MARGIN));
    }
    this.store.update((st) => movePieces(st, after));
    this.onCommit?.({ before: ses.starts, after });
  }
}
