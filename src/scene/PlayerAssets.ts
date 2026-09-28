import * as THREE from 'three';
import {
  buildFigure,
  buildNumberPatch,
  FIGURE_HEIGHT,
  type FigureGeometries,
  type KitColors,
} from './playerGeometry';

const RING_INNER = 0.62;
const RING_OUTER = 0.8;
export const DIM_OPACITY = 0.3;

export function kitKey(kit: KitColors): string {
  return `${kit.shirt}|${kit.shorts}|${kit.socks}`;
}

/**
 * Geometries and materials shared by all player figures: one geometry set per kit
 * (vertex coloured), two shared materials. Only the number textures are per player.
 */
export class PlayerAssets {
  readonly ringGeo = new THREE.RingGeometry(RING_INNER, RING_OUTER, 48).rotateX(-Math.PI / 2);
  /** Big number on the back, small one on the chest. */
  readonly numberBackGeo = buildNumberPatch(1.13, 1.39, 1.5);
  readonly numberFrontGeo = buildNumberPatch(1.24, 1.35, 0.62);
  /** Invisible, generous pick volume (easier to grab, especially by touch). */
  readonly hitGeo = new THREE.CylinderGeometry(0.75, 0.75, FIGURE_HEIGHT + 0.3, 12).translate(
    0,
    (FIGURE_HEIGHT + 0.3) / 2,
    0,
  );
  readonly hitMat = new THREE.MeshBasicMaterial({ visible: false });
  readonly kitMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.62,
    metalness: 0.02,
  });
  readonly kitDimMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.62,
    metalness: 0.02,
    transparent: true,
    opacity: DIM_OPACITY,
    depthWrite: false,
  });

  private blankGeo = new THREE.BufferGeometry();
  /** Stand-in until a player gets its kit (nothing to draw). */
  readonly blankFigure: FigureGeometries = {
    torso: this.blankGeo,
    arm: this.blankGeo,
    thigh: this.blankGeo,
    shin: this.blankGeo,
  };

  private kits = new Map<string, FigureGeometries>();
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

  /** Figure geometries for a kit, built once and shared. */
  figure(kit: KitColors): FigureGeometries {
    const key = kitKey(kit);
    let g = this.kits.get(key);
    if (!g) {
      g = buildFigure(kit);
      this.kits.set(key, g);
    }
    return g;
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

  /** Disposes cached kits / ring materials that no player uses any more. */
  prune(usedKits: ReadonlySet<string>, usedRingColors: ReadonlySet<string>): void {
    for (const [key, g] of this.kits) {
      if (!usedKits.has(key)) {
        disposeFigure(g);
        this.kits.delete(key);
      }
    }
    for (const [key, m] of this.ringMats) {
      if (!usedRingColors.has(key.split('|')[0])) {
        m.dispose();
        this.ringMats.delete(key);
      }
    }
  }

  createNumberMaterial(num: number, color: string): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 112;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = 'bold 92px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(String(num), 64, 62);
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
    for (const g of [
      this.blankGeo,
      this.ringGeo,
      this.numberBackGeo,
      this.numberFrontGeo,
      this.hitGeo,
    ]) {
      g.dispose();
    }
    for (const m of [this.hitMat, this.kitMat, this.kitDimMat, this.ringSelectedMat]) m.dispose();
    for (const g of this.kits.values()) disposeFigure(g);
    for (const m of this.ringMats.values()) m.dispose();
    this.kits.clear();
    this.ringMats.clear();
  }
}

function disposeFigure(g: FigureGeometries): void {
  g.torso.dispose();
  g.arm.dispose();
  g.thigh.dispose();
  g.shin.dispose();
}
