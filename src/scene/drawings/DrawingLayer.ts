import * as THREE from 'three';
import { bendHandle, type Pt } from '../../logic/arrowPath';
import type { Anchor, AppState, ArrowDrawing, Drawing } from '../../state/schema';
import type { Store } from '../../state/store';
import { ArrowView } from './ArrowView';
import { NoteView } from './NoteView';
import { ZoneView } from './ZoneView';

/** Clearance so arrows attached to a player start/end at his ground ring. */
const PLAYER_CLEARANCE = 0.9;
export const PREVIEW_ID = '__preview__';

type View = ArrowView | ZoneView | NoteView;

/**
 * Renders arrows, zones and notes from the store (plus a live preview while drawing).
 * Updated every frame so attached drawings follow players' *visual* positions,
 * including formation animations.
 */
export class DrawingLayer {
  readonly group = new THREE.Group();
  private views = new Map<string, View>();
  private preview: Drawing | null = null;
  private handle: THREE.Mesh;
  private handleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false });

  constructor(
    scene: THREE.Scene,
    private store: Store<AppState>,
    private resolveVisual: (a: Anchor) => Pt | null,
  ) {
    this.group.name = 'drawings';
    const handleGeo = new THREE.CircleGeometry(0.45, 24).rotateX(-Math.PI / 2);
    this.handle = new THREE.Mesh(handleGeo, this.handleMat);
    this.handle.position.y = 0.06;
    this.handle.renderOrder = 6;
    this.handle.visible = false;
    this.group.add(this.handle);
    scene.add(this.group);
  }

  setPreview(d: Drawing | null): void {
    this.preview = d ? { ...d, id: PREVIEW_ID } : null;
  }

  resolve(a: Anchor): Pt | null {
    return this.resolveVisual(a);
  }

  /** Visible centre line of an arrow (for hit testing), or null. */
  arrowPath(id: string): Pt[] | null {
    const v = this.views.get(id);
    return v instanceof ArrowView ? v.centerline : null;
  }

  /** Current bend-handle position of an arrow. */
  handlePoint(d: ArrowDrawing): Pt | null {
    const from = this.resolve(d.from);
    const to = this.resolve(d.to);
    return from && to ? bendHandle(from, to, d.bend) : null;
  }

  update(): void {
    const s = this.store.state;
    const list = this.preview ? [...s.drawings, this.preview] : s.drawings;
    const seen = new Set<string>();
    for (const d of list) {
      seen.add(d.id);
      this.updateView(d, s, d.id === s.selectedDrawing || d.id === PREVIEW_ID);
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        v.dispose();
        this.views.delete(id);
      }
    }

    const sel = s.drawings.find((d) => d.id === s.selectedDrawing);
    const hp = sel?.type === 'arrow' && s.tool === 'select' ? this.handlePoint(sel) : null;
    this.handle.visible = !!hp;
    if (hp) this.handle.position.set(hp.x, 0.06, hp.z);
  }

  private updateView(d: Drawing, s: AppState, highlighted: boolean): void {
    let v = this.views.get(d.id);
    if (d.type === 'arrow') {
      if (!(v instanceof ArrowView)) {
        v?.dispose();
        v = new ArrowView(d.id);
        this.views.set(d.id, v);
        this.group.add(v.group);
      }
      const from = this.resolve(d.from);
      const to = this.resolve(d.to);
      v.group.visible = !!(from && to);
      if (!from || !to) return;
      v.update({
        from,
        to,
        bend: d.bend,
        style: d.style,
        color: s.settings.arrowColors[d.style],
        trimStart: d.from.kind === 'player' ? PLAYER_CLEARANCE : 0,
        trimEnd: d.to.kind === 'player' ? PLAYER_CLEARANCE : 0,
        highlighted,
      });
    } else if (d.type === 'zone') {
      if (!(v instanceof ZoneView)) {
        v?.dispose();
        v = new ZoneView(d.id);
        this.views.set(d.id, v);
        this.group.add(v.group);
      }
      v.update(d, highlighted);
    } else {
      if (!(v instanceof NoteView)) {
        v?.dispose();
        v = new NoteView(d.id);
        this.views.set(d.id, v);
        this.group.add(v.object);
      }
      const at = this.resolve(d.anchor);
      v.object.visible = !!at;
      if (at) v.update(d.text, at, d.anchor.kind === 'player', highlighted);
    }
  }

  dispose(): void {
    for (const v of this.views.values()) v.dispose();
    this.views.clear();
    this.handle.geometry.dispose();
    this.handleMat.dispose();
    this.group.removeFromParent();
  }
}
