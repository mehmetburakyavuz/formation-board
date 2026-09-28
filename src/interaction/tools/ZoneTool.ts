import type { GroundPoint } from '../../core/coords';
import { newDrawingId } from '../../state/drawingOps';
import type { ZoneDrawing } from '../../state/schema';
import type { Tool, ToolContext } from './Tool';

const MIN_SIZE = 1;

/** Drag on the ground to span a translucent rectangle/ellipse (press zone, space…). */
export class ZoneTool implements Tool {
  private g: { pointerId: number; a: GroundPoint; draft: ZoneDrawing | null } | null = null;

  constructor(private ctx: ToolContext) {}

  get active(): boolean {
    return this.g !== null;
  }

  down(e: PointerEvent): boolean {
    const a = this.ctx.picker.ground(e);
    if (!a) return false;
    this.g = { pointerId: e.pointerId, a, draft: null };
    this.ctx.capture(e);
    return true;
  }

  move(e: PointerEvent): void {
    const g = this.g;
    if (!g || e.pointerId !== g.pointerId) return;
    const b = this.ctx.picker.ground(e);
    if (!b) return;
    const { zoneColor, zoneShape } = this.ctx.store.state.settings;
    g.draft = { id: 'draft', type: 'zone', shape: zoneShape, a: g.a, b, color: zoneColor };
    this.ctx.drawings.setPreview(g.draft);
  }

  up(e: PointerEvent): void {
    const g = this.g;
    if (!g || e.pointerId !== g.pointerId) return;
    this.g = null;
    this.ctx.release(e);
    this.ctx.drawings.setPreview(null);
    const d = g.draft;
    if (!d || Math.abs(d.a.x - d.b.x) < MIN_SIZE || Math.abs(d.a.z - d.b.z) < MIN_SIZE) return;
    this.ctx.controller.addDrawing({ ...d, id: newDrawingId() });
  }

  cancel(): void {
    this.g = null;
    this.ctx.drawings.setPreview(null);
  }

  hover(): void {
    this.ctx.pieces.setHovered(null);
    this.ctx.setCursor('crosshair');
  }

  escape(): boolean {
    if (!this.g) return false;
    this.cancel();
    return true;
  }
}
