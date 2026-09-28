import * as THREE from 'three';
import { HALF_LENGTH, HALF_WIDTH } from '../core/coords';

export const SNAP_STEP = 1;
/** Pieces may be placed this far beyond the pitch lines (metres). */
export const DRAG_MARGIN = 3;

/** Faint 1 m ground grid shown while snapping is enabled. */
export class SnapGrid {
  readonly lines: THREE.LineSegments;

  constructor(scene: THREE.Scene) {
    const mx = Math.ceil(HALF_LENGTH + DRAG_MARGIN);
    const mz = Math.ceil(HALF_WIDTH + DRAG_MARGIN);
    const pts: number[] = [];
    for (let x = -mx; x <= mx; x += SNAP_STEP) pts.push(x, 0, -mz, x, 0, mz);
    for (let z = -mz; z <= mz; z += SNAP_STEP) pts.push(-mx, 0, z, mx, 0, z);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    });
    this.lines = new THREE.LineSegments(geo, mat);
    this.lines.position.y = 0.015;
    this.lines.name = 'snap-grid';
    this.lines.visible = false;
    scene.add(this.lines);
  }

  setVisible(on: boolean): void {
    this.lines.visible = on;
  }

  dispose(): void {
    this.lines.geometry.dispose();
    (this.lines.material as THREE.Material).dispose();
    this.lines.removeFromParent();
  }
}
