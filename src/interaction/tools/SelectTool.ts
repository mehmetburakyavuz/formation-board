import { bendFromHandle } from '../../logic/arrowPath';
import { isInteractive } from '../../state/actions';
import type { AppState, ArrowDrawing, PieceId } from '../../state/schema';
import { ClickTracker, hitDrawing, type Tool, type ToolContext } from './Tool';

const HANDLE_HIT_PX = 16;

function isPlayer(s: AppState, id: PieceId): boolean {
  return s.players.some((p) => p.id === id);
}

interface BendDrag {
  pointerId: number;
  before: ArrowDrawing;
}

/** Select / move pieces (incl. box selection), select drawings and adjust arrow bends. */
export class SelectTool implements Tool {
  private click = new ClickTracker();
  /** Piece pressed without shift while already selected: a pure click narrows to it. */
  private narrowTo: PieceId | null = null;
  /** Pressed on empty ground: a pure click clears the selection. */
  private clearOnClick = false;
  private bend: BendDrag | null = null;

  constructor(private ctx: ToolContext) {}

  get active(): boolean {
    return this.ctx.drag.active || this.ctx.selection.boxActive || this.bend !== null;
  }

  /** Active team + ball, plus visible opponents (pressing one switches the active team). */
  private pickables() {
    const s = this.ctx.store.state;
    return this.ctx.pieces.pickables(
      (id) => isInteractive(s, id) || (s.settings.opponentMode !== 'hidden' && isPlayer(s, id)),
    );
  }

  /** Makes the pressed opponent's team active; its selection starts fresh. */
  private switchTeamFor(id: PieceId): boolean {
    const { ctx } = this;
    const s = ctx.store.state;
    const team = s.players.find((p) => p.id === id)?.team;
    if (!team || team === s.activeTeam) return false;
    ctx.controller.setActiveTeam(team);
    ctx.selection.select([id]);
    return true;
  }

  down(e: PointerEvent): boolean {
    const { ctx } = this;
    this.click.begin(e);
    this.narrowTo = null;
    this.clearOnClick = false;

    if (this.tryBeginBend(e)) return true;

    const id = ctx.picker.pickPiece(e, this.pickables());
    if (id) {
      ctx.controller.selectDrawing(null);
      // An opponent press switches teams and selects it alone; otherwise the usual rules.
      if (!this.switchTeamFor(id)) {
        if (e.shiftKey) {
          if (!ctx.selection.toggle(id)) return true; // deselected: nothing to drag
        } else if (ctx.selection.isSelected(id)) {
          this.narrowTo = id;
        } else {
          ctx.selection.select([id]);
        }
      }
      if (ctx.drag.begin(e, id, [...ctx.store.state.selection])) {
        ctx.capture(e);
        ctx.setCursor('grabbing');
        ctx.pieces.setHovered(null);
      }
      return true;
    }

    const drawingId = hitDrawing(ctx, e);
    if (drawingId) {
      ctx.controller.selectDrawing(drawingId);
      return true;
    }

    if (e.shiftKey) {
      ctx.selection.beginBox(e);
      ctx.capture(e);
      return true;
    }
    // Empty ground: the camera rotates; a pure click clears selections.
    this.clearOnClick = true;
    return false;
  }

  private tryBeginBend(e: PointerEvent): boolean {
    const { ctx } = this;
    const s = ctx.store.state;
    const d = s.drawings.find((x) => x.id === s.selectedDrawing);
    if (d?.type !== 'arrow') return false;
    const hp = ctx.drawings.handlePoint(d);
    if (!hp) return false;
    const sp = ctx.picker.toScreen(hp);
    if (Math.hypot(sp.x - e.clientX, sp.y - e.clientY) > HANDLE_HIT_PX) return false;
    this.bend = { pointerId: e.pointerId, before: d };
    ctx.capture(e);
    ctx.setCursor('grabbing');
    return true;
  }

  move(e: PointerEvent): void {
    const { ctx } = this;
    this.click.move(e);
    if (this.bend && e.pointerId === this.bend.pointerId) {
      const d = this.bend.before;
      const from = ctx.drawings.resolve(d.from);
      const to = ctx.drawings.resolve(d.to);
      const g = ctx.picker.ground(e);
      if (from && to && g)
        ctx.controller.previewDrawing({ ...d, bend: bendFromHandle(from, to, g) });
      return;
    }
    if (ctx.drag.active) {
      if (e.pointerId === ctx.drag.pointerId) ctx.drag.move(e);
      return;
    }
    if (ctx.selection.boxActive) ctx.selection.moveBox(e);
  }

  up(e: PointerEvent): void {
    const { ctx } = this;
    const isClick = this.click.end(e);
    if (this.bend && e.pointerId === this.bend.pointerId) {
      const before = this.bend.before;
      this.bend = null;
      const after = ctx.store.state.drawings.find((d) => d.id === before.id);
      if (after) ctx.controller.recordDrawingEdit(before, after);
      ctx.release(e);
      ctx.setCursor('');
      return;
    }
    if (ctx.drag.active && e.pointerId === ctx.drag.pointerId) {
      ctx.drag.end(e);
      ctx.release(e);
      this.hover(e);
    } else if (ctx.selection.boxActive) {
      ctx.selection.endBox(e);
      ctx.release(e);
    }
    if (!isClick) return;
    if (this.narrowTo) ctx.selection.select([this.narrowTo]);
    else if (this.clearOnClick && !e.shiftKey) {
      ctx.selection.clear();
      ctx.controller.selectDrawing(null);
    }
  }

  cancel(): void {
    const { ctx } = this;
    if (ctx.drag.active) ctx.drag.cancel();
    if (ctx.selection.boxActive) ctx.selection.cancelBox();
    if (this.bend) {
      ctx.controller.previewDrawing(this.bend.before);
      this.bend = null;
    }
    this.click.reset();
    ctx.setCursor('');
  }

  hover(e: PointerEvent): void {
    const { ctx } = this;
    const id = ctx.picker.pickPiece(e, this.pickables());
    ctx.pieces.setHovered(id);
    ctx.setCursor(id ? 'grab' : hitDrawing(ctx, e) ? 'pointer' : '');
  }

  escape(): boolean {
    if (!this.active) return false;
    this.cancel();
    return true;
  }
}
