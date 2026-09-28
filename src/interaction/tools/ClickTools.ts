import {
  anchorAt,
  ClickTracker,
  hitDrawing,
  pickAnyPlayer,
  type Tool,
  type ToolContext,
} from './Tool';

/**
 * Tools that act on a plain click. Presses are not consumed, so dragging still
 * rotates the camera.
 */
abstract class ClickTool implements Tool {
  private click = new ClickTracker();

  constructor(protected ctx: ToolContext) {}

  readonly active = false;

  down(e: PointerEvent): boolean {
    this.click.begin(e);
    return false;
  }

  move(e: PointerEvent): void {
    this.click.move(e);
  }

  up(e: PointerEvent): void {
    if (this.click.end(e)) this.onClick(e);
  }

  cancel(): void {
    this.click.reset();
  }

  protected abstract onClick(e: PointerEvent): void;
  abstract hover(e: PointerEvent): void;
}

/** Click on the ground or a player to attach a short text note. */
export class NoteTool extends ClickTool {
  protected onClick(e: PointerEvent): void {
    const existing = hitDrawing(this.ctx, e);
    const d = this.ctx.store.state.drawings.find((x) => x.id === existing);
    if (d?.type === 'note') {
      this.ctx.requestNote(e, d.anchor, d);
      return;
    }
    const anchor = anchorAt(this.ctx, e);
    if (anchor) this.ctx.requestNote(e, anchor);
  }

  hover(e: PointerEvent): void {
    this.ctx.pieces.setHovered(pickAnyPlayer(this.ctx, e));
    this.ctx.setCursor('text');
  }
}

/** Click an arrow, zone or note to delete it. */
export class EraserTool extends ClickTool {
  protected onClick(e: PointerEvent): void {
    const id = hitDrawing(this.ctx, e);
    if (id) this.ctx.controller.removeDrawing(id);
  }

  hover(e: PointerEvent): void {
    this.ctx.pieces.setHovered(null);
    this.ctx.setCursor(hitDrawing(this.ctx, e) ? 'pointer' : 'default');
  }
}
