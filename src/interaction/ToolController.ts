import type { Controller } from '../app/Controller';
import type { DrawingLayer } from '../scene/drawings/DrawingLayer';
import type { PiecesView } from '../scene/PiecesView';
import type { Anchor, AppState, NoteDrawing, PieceId, ToolId } from '../state/schema';
import type { Store } from '../state/store';
import type { DragController } from './DragController';
import type { Picker } from './Picker';
import type { SelectionController } from './SelectionController';
import { ArrowTool } from './tools/ArrowTool';
import { EraserTool, NoteTool } from './tools/ClickTools';
import { SelectTool } from './tools/SelectTool';
import {
  hitDrawing,
  pickAnyPlayer,
  type ScreenPoint,
  type Tool,
  type ToolContext,
} from './tools/Tool';
import { ZoneTool } from './tools/ZoneTool';

export interface ToolControllerDeps {
  el: HTMLElement;
  store: Store<AppState>;
  controller: Controller;
  picker: Picker;
  pieces: PiecesView;
  drawings: DrawingLayer;
  drag: DragController;
  selection: SelectionController;
  requestNote(at: ScreenPoint, anchor: Anchor, existing?: NoteDrawing): void;
  /** Double click on a player: look through his eyes. */
  requestPov(id: PieceId): void;
}

/**
 * Routes pointer events to the active tool. Listens in the capture phase on the
 * viewport so it runs before OrbitControls; a consumed press never reaches the camera.
 */
export class ToolController {
  private tools: Record<ToolId, Tool>;
  private requestPov: (id: PieceId) => void;
  private current: Tool;
  private ctx: ToolContext;
  private el: HTMLElement;

  constructor(deps: ToolControllerDeps) {
    const el = deps.el;
    this.el = el;
    this.requestPov = deps.requestPov;
    this.ctx = {
      ...deps,
      capture: (e) => {
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // Pointer already released (or synthetic); the gesture works without capture.
        }
      },
      release: (e) => {
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      },
      setCursor: (c) => {
        el.style.cursor = c;
      },
    };
    this.tools = {
      select: new SelectTool(this.ctx),
      run: new ArrowTool(this.ctx, 'run'),
      pass: new ArrowTool(this.ctx, 'pass'),
      dribble: new ArrowTool(this.ctx, 'dribble'),
      zone: new ZoneTool(this.ctx),
      note: new NoteTool(this.ctx),
      eraser: new EraserTool(this.ctx),
    };
    this.current = this.tools[deps.store.state.tool];
    deps.store.subscribe((s, prev) => {
      if (s.tool !== prev.tool) this.switchTo(s.tool);
    });

    el.addEventListener('pointerdown', this.onDown, { capture: true });
    el.addEventListener('pointermove', this.onMove, { capture: true });
    el.addEventListener('pointerup', this.onUp, { capture: true });
    el.addEventListener('pointercancel', this.onCancel, { capture: true });
    el.addEventListener('pointerleave', this.onLeave);
    el.addEventListener('dblclick', this.onDblClick);
  }

  private switchTo(id: ToolId): void {
    this.current.cancel();
    this.current = this.tools[id];
    this.ctx.pieces.setHovered(null);
    this.ctx.setCursor(id === 'select' ? '' : 'crosshair');
  }

  private onDown = (e: PointerEvent): void => {
    // A second finger during a gesture must not reach the camera.
    if (this.current.active) {
      e.stopImmediatePropagation();
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.current.down(e)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  };

  private onMove = (e: PointerEvent): void => {
    this.current.move(e);
    if (!this.current.active && e.buttons === 0 && e.pointerType !== 'touch') {
      this.current.hover?.(e);
    }
  };

  private onUp = (e: PointerEvent): void => {
    this.current.up(e);
  };

  private onCancel = (e: PointerEvent): void => {
    this.current.cancel();
    this.ctx.release(e);
  };

  private onLeave = (): void => {
    if (!this.current.active) this.ctx.pieces.setHovered(null);
  };

  /** Double click (select tool): a note edits its text, a player opens his point of view. */
  private onDblClick = (e: MouseEvent): void => {
    if (this.ctx.store.state.tool !== 'select') return;
    const id = hitDrawing(this.ctx, e);
    const d = this.ctx.store.state.drawings.find((x) => x.id === id);
    if (d?.type === 'note') {
      this.ctx.requestNote(e, d.anchor, d);
      return;
    }
    const player = pickAnyPlayer(this.ctx, e);
    if (player) this.requestPov(player);
  };

  /** Escape: abort the current gesture, else clear selections. */
  escape(): void {
    if (this.current.escape?.()) return;
    this.ctx.selection.clear();
    this.ctx.controller.selectDrawing(null);
  }

  dispose(): void {
    const el = this.el;
    el.removeEventListener('pointerdown', this.onDown, { capture: true });
    el.removeEventListener('pointermove', this.onMove, { capture: true });
    el.removeEventListener('pointerup', this.onUp, { capture: true });
    el.removeEventListener('pointercancel', this.onCancel, { capture: true });
    el.removeEventListener('pointerleave', this.onLeave);
    el.removeEventListener('dblclick', this.onDblClick);
  }
}
