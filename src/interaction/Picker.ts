import * as THREE from 'three';
import type { GroundPoint } from '../core/coords';
import type { PieceId } from '../state/schema';

const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/** Screen ↔ world helpers: piece raycasting, ground intersection, projection. */
export class Picker {
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private hitPoint = new THREE.Vector3();
  private tmp = new THREE.Vector3();

  constructor(
    private camera: THREE.PerspectiveCamera,
    private dom: HTMLElement,
  ) {}

  private setRay(clientX: number, clientY: number): void {
    const r = this.dom.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  pickPiece(e: { clientX: number; clientY: number }, objects: THREE.Object3D[]): PieceId | null {
    if (objects.length === 0) return null;
    this.setRay(e.clientX, e.clientY);
    // Pieces may have moved since the last render; refresh their world matrices.
    for (const o of objects) o.updateWorldMatrix(true, false);
    const hits = this.raycaster.intersectObjects(objects, false);
    for (const h of hits) {
      const id: unknown = h.object.userData.pieceId;
      if (typeof id === 'string') return id;
    }
    return null;
  }

  ground(e: { clientX: number; clientY: number }): GroundPoint | null {
    this.setRay(e.clientX, e.clientY);
    const p = this.raycaster.ray.intersectPlane(GROUND, this.hitPoint);
    return p ? { x: p.x, z: p.z } : null;
  }

  /** Project a ground point to client (CSS pixel) coordinates. */
  toScreen(p: GroundPoint, y = 0): { x: number; y: number; visible: boolean } {
    const r = this.dom.getBoundingClientRect();
    this.tmp.set(p.x, y, p.z).project(this.camera);
    return {
      x: r.left + ((this.tmp.x + 1) / 2) * r.width,
      y: r.top + ((1 - this.tmp.y) / 2) * r.height,
      visible: this.tmp.z < 1,
    };
  }
}
