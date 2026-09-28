import * as THREE from 'three';
import { BALL_ID } from '../state/schema';

export const BALL_RADIUS = 0.11;
const LIFT_HEIGHT = 0.3;
const PENTAGON_RADIUS = 0.36; // angular radius (rad) of each black patch

/** Equirectangular texture (matches SphereGeometry UVs) with 12 black pentagons. */
function createBallTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  if (!ctx) return tex;

  const phi = (1 + Math.sqrt(5)) / 2;
  const raw: [number, number, number][] = [];
  for (const a of [-1, 1]) {
    for (const b of [-phi, phi]) raw.push([0, a, b], [a, b, 0], [b, 0, a]);
  }
  const axes = raw.map((v) => new THREE.Vector3(...v).normalize());
  // Tangent frame per axis for the pentagon's angular shape.
  const frames = axes.map((a) => {
    const helper = Math.abs(a.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const t1 = new THREE.Vector3().crossVectors(a, helper).normalize();
    const t2 = new THREE.Vector3().crossVectors(a, t1);
    return { a, t1, t2 };
  });

  const img = ctx.createImageData(w, h);
  const dir = new THREE.Vector3();
  const sector = (Math.PI * 2) / 5;
  for (let py = 0; py < h; py++) {
    const theta = ((py + 0.5) / h) * Math.PI;
    for (let px = 0; px < w; px++) {
      const ph = ((px + 0.5) / w) * Math.PI * 2;
      dir.set(-Math.cos(ph) * Math.sin(theta), Math.cos(theta), Math.sin(ph) * Math.sin(theta));
      let best = frames[0];
      let bestDot = -2;
      for (const f of frames) {
        const d = dir.dot(f.a);
        if (d > bestDot) {
          bestDot = d;
          best = f;
        }
      }
      let shade = 245;
      const rho = Math.acos(Math.min(1, bestDot));
      const psi = Math.atan2(dir.dot(best.t2), dir.dot(best.t1)) + Math.PI;
      const local = (psi % sector) - sector / 2;
      const edge = (PENTAGON_RADIUS * Math.cos(sector / 2)) / Math.cos(local);
      if (rho < edge) shade = 22;
      else if (rho < edge + 0.02) shade = 150; // soft seam
      const i = (py * w + px) * 4;
      img.data[i] = shade;
      img.data[i + 1] = shade;
      img.data[i + 2] = shade;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export class Ball {
  readonly root = new THREE.Group();
  readonly hit: THREE.Mesh;
  private sphere: THREE.Mesh;
  private ring: THREE.Mesh;
  private texture = createBallTexture();
  private material = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.45 });
  private ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  private hitMat = new THREE.MeshBasicMaterial({ visible: false });
  private visualScale = 1;
  private lifted = false;
  private hovered = false;
  private selected = false;
  private lift = 0;

  constructor() {
    this.root.name = 'ball';
    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 32, 16), this.material);
    this.sphere.castShadow = true;
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.38, 32).rotateX(-Math.PI / 2),
      this.ringMat,
    );
    this.ring.position.y = 0.02;
    this.ring.visible = false;
    this.hit = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), this.hitMat);
    this.hit.position.y = 0.3;
    this.hit.userData.pieceId = BALL_ID;
    this.root.add(this.sphere, this.ring, this.hit);
  }

  setPosition(x: number, z: number): void {
    this.root.position.set(x, 0, z);
  }

  setScale(s: number): void {
    this.visualScale = s;
  }

  setSelected(on: boolean): void {
    this.selected = on;
    this.ring.visible = on;
  }

  setHovered(on: boolean): void {
    this.hovered = on;
  }

  setLifted(on: boolean): void {
    this.lifted = on;
  }

  update(dtMs: number, timeMs: number): void {
    const k = 1 - Math.exp(-dtMs / 60);
    this.lift += ((this.lifted ? LIFT_HEIGHT : 0) - this.lift) * k;
    const s = this.visualScale * (this.hovered || this.lifted ? 1.1 : 1);
    this.sphere.scale.setScalar(s);
    this.sphere.position.y = BALL_RADIUS * s + this.lift;
    if (this.selected) {
      const pulse = 1 + Math.sin(timeMs / 180) * 0.08;
      this.ring.scale.set(pulse, 1, pulse);
    }
  }

  dispose(): void {
    this.sphere.geometry.dispose();
    this.ring.geometry.dispose();
    this.hit.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.ringMat.dispose();
    this.hitMat.dispose();
    this.root.removeFromParent();
  }
}
