import type { Pt } from '../../logic/arrowPath';
import { newDrawingId } from '../../state/drawingOps';
import type { Anchor, ArrowDrawing, ArrowStyle } from '../../state/schema';
import { anchorAt, pickAnyPlayer, type Tool, type ToolContext } from './Tool';

const MIN_LENGTH = 1;
/** Default bend (fraction of the length) when Alt is held while drawing. */
const ALT_BEND = 0.22;

interface Gesture {
  pointerId: number;
  from: Anchor;
  draft: ArrowDrawing | null;
}

/**
 * Run (solid), pass (dashed) and dribble (wavy) arrows. Starts at the player under the
 * pointer (or the ground); passes snap onto a target player. Alt while dragging = curve.
 */
export class ArrowTool implements Tool {
  private g: Gesture | null = null;

  constructor(
    private ctx: ToolContext,
    private style: ArrowStyle,
  ) {}

  get active(): boolean {
    return this.g !== null;
  }

  down(e: PointerEvent): boolean {
    const from = anchorAt(this.ctx, e);
    if (!from) return false;
    this.g = { pointerId: e.pointerId, from, draft: null };
    this.ctx.capture(e);
    return true;
  }

  move(e: PointerEvent): void {
    const g = this.g;
    if (!g || e.pointerId !== g.pointerId) return;
    const to = this.targetAnchor(e, g.from);
    if (!to) return;
    const a = this.ctx.drawings.resolve(g.from);
    const b = this.ctx.drawings.resolve(to);
    if (!a || !b) return;
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    g.draft = {
      id: 'draft',
      type: 'arrow',
      style: this.style,
      from: g.from,
      to,
      bend: e.altKey ? length * ALT_BEND : 0,
    };
    this.ctx.drawings.setPreview(length >= MIN_LENGTH ? g.draft : null);
  }

  /** Pass arrows lock onto a player under the pointer; others end on the ground. */
  private targetAnchor(e: PointerEvent, from: Anchor): Anchor | null {
    if (this.style === 'pass') {
      const id = pickAnyPlayer(this.ctx, e);
      if (id && !(from.kind === 'player' && from.id === id)) return { kind: 'player', id };
    }
    const p: Pt | null = this.ctx.picker.ground(e);
    return p ? { kind: 'point', x: p.x, z: p.z } : null;
  }

  up(e: PointerEvent): void {
    const g = this.g;
    if (!g || e.pointerId !== g.pointerId) return;
    this.g = null;
    this.ctx.release(e);
    this.ctx.drawings.setPreview(null);
    const d = g.draft;
    if (!d) return;
    const a = this.ctx.drawings.resolve(d.from);
    const b = this.ctx.drawings.resolve(d.to);
    if (!a || !b || Math.hypot(b.x - a.x, b.z - a.z) < MIN_LENGTH) return;
    this.ctx.controller.addDrawing({ ...d, id: newDrawingId() });
  }

  cancel(): void {
    this.g = null;
    this.ctx.drawings.setPreview(null);
  }

  hover(e: PointerEvent): void {
    const id = pickAnyPlayer(this.ctx, e);
    this.ctx.pieces.setHovered(id);
    this.ctx.setCursor('crosshair');
  }

  escape(): boolean {
    if (!this.g) return false;
    this.cancel();
    return true;
  }
}
