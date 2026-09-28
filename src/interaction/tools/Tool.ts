import type { Controller } from '../../app/Controller';
import type { GroundPoint } from '../../core/coords';
import { distanceToPolyline } from '../../logic/arrowPath';
import type { DrawingLayer } from '../../scene/drawings/DrawingLayer';
import type { PiecesView } from '../../scene/PiecesView';
import { pointInZone } from '../../logic/arrowPath';
import {
  BALL_ID,
  type Anchor,
  type AppState,
  type NoteDrawing,
  type PieceId,
} from '../../state/schema';
import type { Store } from '../../state/store';
import type { DragController } from '../DragController';
import type { Picker } from '../Picker';
import type { SelectionController } from '../SelectionController';

export const CLICK_TOLERANCE_PX = 5;
const ARROW_HIT_PX = 10;

export interface ScreenPoint {
  clientX: number;
  clientY: number;
}

/** Everything a tool needs; built once by the ToolController. */
export interface ToolContext {
  el: HTMLElement;
  store: Store<AppState>;
  controller: Controller;
  picker: Picker;
  pieces: PiecesView;
  drawings: DrawingLayer;
  drag: DragController;
  selection: SelectionController;
  capture(e: PointerEvent): void;
  release(e: PointerEvent): void;
  setCursor(c: string): void;
  /** Opens the note editor (UI) at a screen position. */
  requestNote(at: ScreenPoint, anchor: Anchor, existing?: NoteDrawing): void;
}

export interface Tool {
  /** Return true to consume the press (the camera will not see it). */
  down(e: PointerEvent): boolean;
  move(e: PointerEvent): void;
  up(e: PointerEvent): void;
  cancel(): void;
  /** A gesture (drag, drawing…) is in progress. */
  readonly active: boolean;
  hover?(e: PointerEvent): void;
  /** Esc handling; return true if the tool used it. */
  escape?(): boolean;
}

/** Visible players (hidden opponents excluded) under the pointer. */
export function pickAnyPlayer(ctx: ToolContext, e: ScreenPoint): PieceId | null {
  const s = ctx.store.state;
  const objs = ctx.pieces.pickables((id) => {
    if (id === BALL_ID) return false;
    const p = s.players.find((pl) => pl.id === id);
    return !!p && (p.team === s.activeTeam || s.settings.opponentMode !== 'hidden');
  });
  return ctx.picker.pickPiece(e, objs);
}

/** Drawing under the pointer: notes (DOM), then arrows, then zones — topmost first. */
export function hitDrawing(
  ctx: ToolContext,
  e: ScreenPoint & { target: EventTarget | null },
): string | null {
  if (e.target instanceof Element) {
    const note = e.target.closest<HTMLElement>('[data-drawing-id]');
    if (note?.dataset.drawingId) return note.dataset.drawingId;
  }
  const s = ctx.store.state;
  for (let i = s.drawings.length - 1; i >= 0; i--) {
    const d = s.drawings[i];
    if (d.type !== 'arrow') continue;
    const path = ctx.drawings.arrowPath(d.id);
    if (!path || path.length < 2) continue;
    const screen = path.map((p) => {
      const sp = ctx.picker.toScreen(p);
      return { x: sp.x, z: sp.y };
    });
    if (distanceToPolyline({ x: e.clientX, z: e.clientY }, screen) <= ARROW_HIT_PX) return d.id;
  }
  const g = ctx.picker.ground(e);
  if (g) {
    for (let i = s.drawings.length - 1; i >= 0; i--) {
      const d = s.drawings[i];
      if (d.type === 'zone' && pointInZone(g, d.a, d.b, d.shape)) return d.id;
    }
  }
  return null;
}

/** Anchor for a press: the player under the pointer, else the ground point. */
export function anchorAt(ctx: ToolContext, e: ScreenPoint): Anchor | null {
  const id = pickAnyPlayer(ctx, e);
  if (id) return { kind: 'player', id };
  const g: GroundPoint | null = ctx.picker.ground(e);
  return g ? { kind: 'point', x: g.x, z: g.z } : null;
}

/** Tracks whether a press stayed a click (moved less than the tolerance). */
export class ClickTracker {
  private start: { id: number; x: number; y: number } | null = null;

  begin(e: PointerEvent): void {
    this.start = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }

  move(e: PointerEvent): void {
    const s = this.start;
    if (
      s &&
      s.id === e.pointerId &&
      Math.hypot(e.clientX - s.x, e.clientY - s.y) > CLICK_TOLERANCE_PX
    ) {
      this.start = null;
    }
  }

  /** True if this pointer-up completes a click. Resets the tracker. */
  end(e: PointerEvent): boolean {
    const ok = this.start !== null && this.start.id === e.pointerId;
    this.start = null;
    return ok;
  }

  reset(): void {
    this.start = null;
  }
}
