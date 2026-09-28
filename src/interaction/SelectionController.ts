import { getPiecePosition, isInteractive, setSelection } from '../state/actions';
import { BALL_ID, type AppState, type PieceId } from '../state/schema';
import type { Store } from '../state/store';
import type { Picker } from './Picker';

interface BoxSession {
  pointerId: number;
  x0: number;
  y0: number;
  base: PieceId[];
}

/** Click / shift-click / box selection. Selection lives in the store. */
export class SelectionController {
  private box: BoxSession | null = null;
  private rectEl: HTMLDivElement;

  constructor(
    private store: Store<AppState>,
    private picker: Picker,
    container: HTMLElement,
  ) {
    this.rectEl = document.createElement('div');
    this.rectEl.className = 'selection-box';
    this.rectEl.hidden = true;
    container.appendChild(this.rectEl);
  }

  get selection(): readonly PieceId[] {
    return this.store.state.selection;
  }

  isSelected(id: PieceId): boolean {
    return this.store.state.selection.includes(id);
  }

  select(ids: PieceId[]): void {
    this.store.update((s) => setSelection(s, ids));
  }

  clear(): void {
    this.select([]);
  }

  toggle(id: PieceId): boolean {
    const sel = this.store.state.selection;
    const on = !sel.includes(id);
    this.select(on ? [...sel, id] : sel.filter((x) => x !== id));
    return on;
  }

  selectActiveTeam(): void {
    const s = this.store.state;
    this.select(s.players.filter((p) => p.team === s.activeTeam).map((p) => p.id));
  }

  // --- Box selection -------------------------------------------------------

  get boxActive(): boolean {
    return this.box !== null;
  }

  beginBox(e: PointerEvent): void {
    this.box = {
      pointerId: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      base: [...this.store.state.selection],
    };
    this.updateRect(e.clientX, e.clientY);
    this.rectEl.hidden = false;
  }

  moveBox(e: PointerEvent): void {
    if (!this.box || e.pointerId !== this.box.pointerId) return;
    this.updateRect(e.clientX, e.clientY);
    this.applyBox(e.clientX, e.clientY);
  }

  endBox(e: PointerEvent): void {
    if (!this.box || e.pointerId !== this.box.pointerId) return;
    this.applyBox(e.clientX, e.clientY);
    this.cancelBox();
  }

  cancelBox(): void {
    this.box = null;
    this.rectEl.hidden = true;
  }

  private updateRect(x: number, y: number): void {
    if (!this.box) return;
    const parent = this.rectEl.parentElement?.getBoundingClientRect();
    const ox = parent?.left ?? 0;
    const oy = parent?.top ?? 0;
    const l = Math.min(this.box.x0, x);
    const t = Math.min(this.box.y0, y);
    Object.assign(this.rectEl.style, {
      left: `${l - ox}px`,
      top: `${t - oy}px`,
      width: `${Math.abs(x - this.box.x0)}px`,
      height: `${Math.abs(y - this.box.y0)}px`,
    });
  }

  /** Selection = pieces at gesture start ∪ interactive pieces inside the rectangle. */
  private applyBox(x: number, y: number): void {
    if (!this.box) return;
    const s = this.store.state;
    const l = Math.min(this.box.x0, x);
    const r = Math.max(this.box.x0, x);
    const t = Math.min(this.box.y0, y);
    const b = Math.max(this.box.y0, y);
    const inside: PieceId[] = [];
    const ids = [...s.players.map((p) => p.id), BALL_ID];
    for (const id of ids) {
      if (!isInteractive(s, id)) continue;
      const p = getPiecePosition(s, id);
      if (!p) continue;
      const sp = this.picker.toScreen(p, 0.9);
      if (sp.visible && sp.x >= l && sp.x <= r && sp.y >= t && sp.y <= b) inside.push(id);
    }
    const merged = [...this.box.base];
    for (const id of inside) if (!merged.includes(id)) merged.push(id);
    this.select(merged);
  }

  dispose(): void {
    this.rectEl.remove();
  }
}
