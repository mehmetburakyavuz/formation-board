import * as THREE from 'three';

export const BODY_RADIUS = 0.32;
const BODY_LENGTH = 0.95;
export const BODY_CENTER_Y = BODY_LENGTH / 2 + BODY_RADIUS;
const HEAD_RADIUS = 0.16;
export const HEAD_Y = BODY_LENGTH + BODY_RADIUS * 2 + HEAD_RADIUS * 0.75;
export const FIGURE_HEIGHT = HEAD_Y + HEAD_RADIUS;
const RING_INNER = 0.62;
const RING_OUTER = 0.8;
const NUMBER_ARC = 1.3; // radians of the shirt covered by the number
const NUMBER_HEIGHT = 0.42;
export const NUMBER_Y = BODY_CENTER_Y + 0.12;
export const DIM_OPACITY = 0.3;

/**
 * Geometries and materials shared by all player figures.
 * Only the number textures are per player.
 */
export class PlayerAssets {
  readonly bodyGeo = new THREE.CapsuleGeometry(BODY_RADIUS, BODY_LENGTH, 6, 20);
  readonly headGeo = new THREE.SphereGeometry(HEAD_RADIUS, 20, 14);
  readonly ringGeo = new THREE.RingGeometry(RING_INNER, RING_OUTER, 48).rotateX(-Math.PI / 2);
  readonly numberGeo = new THREE.CylinderGeometry(
    BODY_RADIUS + 0.004,
    BODY_RADIUS + 0.004,
    NUMBER_HEIGHT,
    16,
    1,
    true,
    Math.PI / 2 - NUMBER_ARC / 2,
    NUMBER_ARC,
  );
  /** Invisible, generous pick volume (easier to grab, especially by touch). */
  readonly hitGeo = new THREE.CylinderGeometry(0.75, 0.75, FIGURE_HEIGHT + 0.3, 12).translate(
    0,
    (FIGURE_HEIGHT + 0.3) / 2,
    0,
  );
  readonly hitMat = new THREE.MeshBasicMaterial({ visible: false });
  readonly headMat = new THREE.MeshStandardMaterial({ color: 0xd9b08c, roughness: 0.6 });

  private bodyMats = new Map<string, THREE.MeshStandardMaterial>();
  private ringMats = new Map<string, THREE.MeshBasicMaterial>();
  readonly ringSelectedMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  readonly headDimMat = new THREE.MeshStandardMaterial({
    color: 0xd9b08c,
    roughness: 0.6,
    transparent: true,
    opacity: DIM_OPACITY,
    depthWrite: false,
  });

  /** Shared per colour; `dim` variants are translucent (for a faded opponent). */
  bodyMaterial(color: string, dim = false): THREE.MeshStandardMaterial {
    const key = `${color}|${dim}`;
    let m = this.bodyMats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.55,
        metalness: 0.05,
        transparent: dim,
        opacity: dim ? DIM_OPACITY : 1,
        depthWrite: !dim,
      });
      this.bodyMats.set(key, m);
    }
    return m;
  }

  ringMaterial(color: string, dim = false): THREE.MeshBasicMaterial {
    const key = `${color}|${dim}`;
    let m = this.ringMats.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: dim ? 0.25 : 0.85,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
      this.ringMats.set(key, m);
    }
    return m;
  }

  /** Disposes cached colour materials whose colour is no longer used by any team. */
  prune(usedColors: ReadonlySet<string>): void {
    for (const cache of [this.bodyMats, this.ringMats]) {
      for (const [key, m] of cache) {
        if (!usedColors.has(key.split('|')[0])) {
          m.dispose();
          cache.delete(key);
        }
      }
    }
  }

  createNumberMaterial(num: number, color: string): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = 'bold 76px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(String(num), 64, 52);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return new THREE.MeshStandardMaterial({
      map,
      transparent: true,
      alphaTest: 0.3,
      roughness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
  }

  dispose(): void {
    for (const g of [this.bodyGeo, this.headGeo, this.ringGeo, this.numberGeo, this.hitGeo]) {
      g.dispose();
    }
    this.hitMat.dispose();
    this.headMat.dispose();
    this.headDimMat.dispose();
    this.ringSelectedMat.dispose();
    for (const m of this.bodyMats.values()) m.dispose();
    for (const m of this.ringMats.values()) m.dispose();
    this.bodyMats.clear();
    this.ringMats.clear();
  }
}
