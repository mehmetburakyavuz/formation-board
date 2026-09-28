import { isInteractive, setSelection } from '../state/actions';
import type { AppState, PieceId } from '../state/schema';
import type { Store } from '../state/store';
import type { PiecesView } from '../scene/PiecesView';
import type { DragController } from './DragController';
import type { Picker } from './Picker';
import type { SelectionController } from './SelectionController';

const CLICK_TOLERANCE_PX = 5;

interface PendingClick {
  pointerId: number;
  x: number;
  y: number;
  /** Piece pressed without shift while already selected: on a pure click, select only it. */
  narrowTo: PieceId | null;
  /** Pressed on empty ground: on a pure click, clear the selection. */
  clearOnClick: boolean;
}

/**
 * Routes pointer events for the active tool (M2: select/move only).
 * Listens in the capture phase on the viewport so it runs before OrbitControls
 * and can stop the camera from ever seeing a press on a piece.
 */
export class ToolController {
  private pending: PendingClick | null = null;

  constructor(
    private el: HTMLElement,
    private store: Store<AppState>,
    private picker: Picker,
    private view: PiecesView,
    private drag: DragController,
    private selection: SelectionController,
  ) {
    el.addEventListener('pointerdown', this.onDown, { capture: true });
    el.addEventListener('pointermove', this.onMove, { capture: true });
    el.addEventListener('pointerup', this.onUp, { capture: true });
    el.addEventListener('pointercancel', this.onCancel, { capture: true });
    el.addEventListener('pointerleave', this.onLeave);
  }

  private pickables() {
    const s = this.store.state;
    return this.view.pickables((id) => isInteractive(s, id));
  }

  private onDown = (e: PointerEvent): void => {
    // A second finger during a drag/box gesture must not reach the camera.
    if (this.drag.active || this.selection.boxActive) {
      e.stopImmediatePropagation();
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const id = this.picker.pickPiece(e, this.pickables());
    if (id) {
      e.stopImmediatePropagation();
      e.preventDefault();
      let narrowTo: PieceId | null = null;
      if (e.shiftKey) {
        if (!this.selection.toggle(id)) return; // deselected: nothing to drag
      } else if (this.selection.isSelected(id)) {
        narrowTo = id;
      } else {
        this.selection.select([id]);
      }
      if (this.drag.begin(e, id, [...this.store.state.selection])) {
        this.capture(e);
        this.setCursor('grabbing');
        this.view.setHovered(null);
      }
      this.pending = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        narrowTo,
        clearOnClick: false,
      };
      return;
    }

    if (e.shiftKey) {
      e.stopImmediatePropagation();
      e.preventDefault();
      this.selection.beginBox(e);
      this.capture(e);
      return;
    }
    // Empty ground: let OrbitControls rotate; a pure click clears the selection.
    this.pending = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      narrowTo: null,
      clearOnClick: true,
    };
  };

  private onMove = (e: PointerEvent): void => {
    if (this.pending && e.pointerId === this.pending.pointerId) {
      const d = Math.hypot(e.clientX - this.pending.x, e.clientY - this.pending.y);
      if (d > CLICK_TOLERANCE_PX) this.pending = null;
    }
    if (this.drag.active) {
      if (e.pointerId === this.drag.pointerId) this.drag.move(e);
      return;
    }
    if (this.selection.boxActive) {
      this.selection.moveBox(e);
      return;
    }
    if (e.buttons === 0 && e.pointerType !== 'touch') this.updateHover(e);
  };

  private onUp = (e: PointerEvent): void => {
    if (this.drag.active && e.pointerId === this.drag.pointerId) {
      this.drag.end(e);
      this.releaseCapture(e);
      this.updateHover(e);
    } else if (this.selection.boxActive) {
      this.selection.endBox(e);
      this.releaseCapture(e);
    }
    const p = this.pending;
    if (p && p.pointerId === e.pointerId) {
      if (p.narrowTo) this.selection.select([p.narrowTo]);
      else if (p.clearOnClick && !e.shiftKey) this.selection.clear();
      this.pending = null;
    }
  };

  private onCancel = (e: PointerEvent): void => {
    if (this.drag.active && e.pointerId === this.drag.pointerId) this.drag.cancel();
    if (this.selection.boxActive) this.selection.cancelBox();
    this.pending = null;
    this.releaseCapture(e);
    this.setCursor('');
  };

  private onLeave = (): void => {
    if (!this.drag.active) {
      this.view.setHovered(null);
      this.setCursor('');
    }
  };

  private capture(e: PointerEvent): void {
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // Pointer already released (or synthetic); gesture still works without capture.
    }
  }

  private releaseCapture(e: PointerEvent): void {
    if (this.el.hasPointerCapture(e.pointerId)) this.el.releasePointerCapture(e.pointerId);
  }

  private updateHover(e: PointerEvent): void {
    const id = this.picker.pickPiece(e, this.pickables());
    this.view.setHovered(id);
    this.setCursor(id ? 'grab' : '');
  }

  private setCursor(c: string): void {
    this.el.style.cursor = c;
  }

  /** Escape: abort gestures first, otherwise clear the selection. */
  escape(): void {
    if (this.drag.active) this.drag.cancel();
    else if (this.selection.boxActive) this.selection.cancelBox();
    else this.store.update((s) => setSelection(s, []));
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.onDown, { capture: true });
    this.el.removeEventListener('pointermove', this.onMove, { capture: true });
    this.el.removeEventListener('pointerup', this.onUp, { capture: true });
    this.el.removeEventListener('pointercancel', this.onCancel, { capture: true });
    this.el.removeEventListener('pointerleave', this.onLeave);
  }
}
