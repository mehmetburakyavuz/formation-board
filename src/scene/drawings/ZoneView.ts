import * as THREE from 'three';
import type { ZoneDrawing } from '../../state/schema';
import { FlatGeometryBuilder, type P } from '../flatGeometry';

const Y = 0.018;
const OUTLINE = 0.18;
const ELLIPSE_SEGMENTS = 64;

function outlinePoints(z: Pick<ZoneDrawing, 'a' | 'b' | 'shape'>): P[] {
  const minX = Math.min(z.a.x, z.b.x);
  const maxX = Math.max(z.a.x, z.b.x);
  const minZ = Math.min(z.a.z, z.b.z);
  const maxZ = Math.max(z.a.z, z.b.z);
  if (z.shape === 'rect') {
    return [
      [minX, minZ],
      [maxX, minZ],
      [maxX, maxZ],
      [minX, maxZ],
    ];
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const rx = (maxX - minX) / 2;
  const rz = (maxZ - minZ) / 2;
  const pts: P[] = [];
  for (let i = 0; i < ELLIPSE_SEGMENTS; i++) {
    const a = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]);
  }
  return pts;
}

/** Translucent ground area (rectangle or ellipse) with a solid outline. */
export class ZoneView {
  readonly group = new THREE.Group();
  private fill: THREE.Mesh;
  private edge: THREE.Mesh;
  private fillMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  private edgeMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  private key = '';

  constructor(readonly id: string) {
    this.fill = new THREE.Mesh(new THREE.BufferGeometry(), this.fillMat);
    this.edge = new THREE.Mesh(new THREE.BufferGeometry(), this.edgeMat);
    this.fill.position.y = Y;
    this.edge.position.y = Y + 0.002;
    this.fill.renderOrder = 2;
    this.edge.renderOrder = 2;
    this.group.add(this.fill, this.edge);
  }

  update(z: Pick<ZoneDrawing, 'a' | 'b' | 'shape' | 'color'>, highlighted: boolean): void {
    const key = `${z.a.x},${z.a.z},${z.b.x},${z.b.z},${z.shape},${z.color},${highlighted}`;
    if (key === this.key) return;
    this.key = key;
    this.fillMat.color.set(z.color);
    this.edgeMat.color.set(z.color);
    this.fillMat.opacity = highlighted ? 0.32 : 0.22;
    const pts = outlinePoints(z);
    new FlatGeometryBuilder().fan(pts).build(this.fill.geometry);
    new FlatGeometryBuilder().strip(pts, OUTLINE, true).build(this.edge.geometry);
  }

  dispose(): void {
    this.fill.geometry.dispose();
    this.edge.geometry.dispose();
    this.fillMat.dispose();
    this.edgeMat.dispose();
    this.group.removeFromParent();
  }
}
