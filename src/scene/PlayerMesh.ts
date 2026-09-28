import * as THREE from 'three';
import { easing } from '../core/tween';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import {
  BODY_CENTER_Y,
  DIM_OPACITY,
  FIGURE_HEIGHT,
  HEAD_Y,
  NUMBER_Y,
  type PlayerAssets,
} from './PlayerAssets';

export type PlayerVisibility = 'normal' | 'dim' | 'hidden';

export interface PlayerAppearance {
  number: number;
  label: string;
  /** Instruction badge texts shown under the label. */
  badges: readonly string[];
  bodyColor: string;
  numberColor: string;
  ringColor: string;
  /** +1 faces +X (home attack direction), -1 faces -X. */
  facing: 1 | -1;
}

const LIFT_HEIGHT = 0.3;

interface Glide {
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  elapsed: number;
  delay: number;
  duration: number;
}
const HOVER_SCALE = 1.05;

/** Stylised player figure: capsule body, head, shirt numbers, ground ring and label. */
export class PlayerMesh {
  readonly root = new THREE.Group();
  readonly hit: THREE.Mesh;
  private figure = new THREE.Group();
  private body: THREE.Mesh;
  private head: THREE.Mesh;
  private visibility: PlayerVisibility = 'normal';
  private labelVisible = true;
  private ring: THREE.Mesh;
  private numberMat: THREE.MeshStandardMaterial | null = null;
  private numberFront: THREE.Mesh;
  private numberBack: THREE.Mesh;
  private label: CSS2DObject;
  private labelNum: HTMLSpanElement;
  private labelName: HTMLSpanElement;
  private badges: HTMLDivElement;
  private badgeKey = '';
  private appearance: PlayerAppearance | null = null;

  private selected = false;
  private hovered = false;
  private lifted = false;
  private lift = 0;
  private scale = 1;
  private glide: Glide | null = null;

  constructor(
    readonly id: string,
    private assets: PlayerAssets,
  ) {
    this.root.name = `player:${id}`;

    this.body = new THREE.Mesh(assets.bodyGeo, assets.hitMat);
    this.body.position.y = BODY_CENTER_Y;
    this.body.castShadow = true;

    const head = new THREE.Mesh(assets.headGeo, assets.headMat);
    head.position.y = HEAD_Y;
    head.castShadow = true;
    this.head = head;

    this.numberFront = new THREE.Mesh(assets.numberGeo, assets.hitMat);
    this.numberFront.position.y = NUMBER_Y;
    this.numberBack = new THREE.Mesh(assets.numberGeo, assets.hitMat);
    this.numberBack.position.y = NUMBER_Y;
    this.numberBack.rotation.y = Math.PI;

    this.figure.add(this.body, head, this.numberFront, this.numberBack);

    this.ring = new THREE.Mesh(assets.ringGeo, assets.ringSelectedMat);
    this.ring.position.y = 0.02;
    this.ring.renderOrder = 1;

    this.hit = new THREE.Mesh(assets.hitGeo, assets.hitMat);
    this.hit.userData.pieceId = id;

    const tag = document.createElement('div');
    tag.className = 'player-tag';
    const pill = document.createElement('div');
    pill.className = 'player-label';
    this.labelNum = document.createElement('span');
    this.labelNum.className = 'num';
    this.labelName = document.createElement('span');
    this.labelName.className = 'name';
    pill.append(this.labelNum, this.labelName);
    this.badges = document.createElement('div');
    this.badges.className = 'badges';
    tag.append(pill, this.badges);
    this.label = new CSS2DObject(tag);
    this.label.position.y = FIGURE_HEIGHT + 0.35;
    this.label.center.set(0.5, 1);

    this.figure.add(this.label);
    this.root.add(this.figure, this.ring, this.hit);
  }

  /** Jump to a position (cancels any running glide). */
  setPosition(x: number, z: number): void {
    this.glide = null;
    this.root.position.set(x, 0, z);
  }

  /** Glide from the current visual position to (x, z), easeInOutCubic. */
  glideTo(x: number, z: number, durationMs: number, delayMs: number): void {
    const { x: fx, z: fz } = this.root.position;
    if (Math.abs(fx - x) < 1e-6 && Math.abs(fz - z) < 1e-6) {
      this.setPosition(x, z);
      return;
    }
    this.glide = {
      fromX: fx,
      fromZ: fz,
      toX: x,
      toZ: z,
      elapsed: 0,
      delay: delayMs,
      duration: durationMs,
    };
  }

  private stepGlide(dtMs: number): void {
    const g = this.glide;
    if (!g) return;
    g.elapsed += dtMs;
    const t = Math.min(1, Math.max(0, (g.elapsed - g.delay) / g.duration));
    const k = easing.easeInOutCubic(t);
    this.root.position.set(g.fromX + (g.toX - g.fromX) * k, 0, g.fromZ + (g.toZ - g.fromZ) * k);
    if (t >= 1) this.glide = null;
  }

  setAppearance(a: PlayerAppearance): void {
    const prev = this.appearance;
    this.appearance = a;
    if (!prev || prev.number !== a.number || prev.numberColor !== a.numberColor) {
      this.disposeNumber();
      this.numberMat = this.assets.createNumberMaterial(a.number, a.numberColor);
      this.numberFront.material = this.numberMat;
      this.numberBack.material = this.numberMat;
    }
    this.applyMaterials();
    this.figure.rotation.y = a.facing === 1 ? 0 : Math.PI;
    this.labelNum.textContent = String(a.number);
    this.labelName.textContent = a.label;
    this.labelNum.style.background = a.bodyColor;
    this.labelNum.style.color = a.numberColor;
    const badgeKey = a.badges.join('|');
    if (badgeKey !== this.badgeKey) {
      this.badgeKey = badgeKey;
      this.badges.replaceChildren(
        ...a.badges.map((text) => {
          const b = document.createElement('span');
          b.className = 'badge';
          b.textContent = text;
          return b;
        }),
      );
    }
  }

  setLabelVisible(visible: boolean): void {
    this.labelVisible = visible;
    this.label.visible = visible && this.visibility !== 'hidden';
  }

  /** Normal, faded (translucent) or hidden — used for the opponent team. */
  setVisibility(v: PlayerVisibility): void {
    if (this.visibility === v) return;
    this.visibility = v;
    this.root.visible = v !== 'hidden';
    this.label.visible = this.labelVisible && v !== 'hidden';
    this.label.element.classList.toggle('dim', v === 'dim');
    this.applyMaterials();
  }

  private applyMaterials(): void {
    const a = this.appearance;
    if (!a) return;
    const dim = this.visibility === 'dim';
    this.body.material = this.assets.bodyMaterial(a.bodyColor, dim);
    this.head.material = dim ? this.assets.headDimMat : this.assets.headMat;
    this.body.castShadow = !dim;
    this.head.castShadow = !dim;
    if (this.numberMat) this.numberMat.opacity = dim ? DIM_OPACITY : 1;
    this.updateRingMaterial();
  }

  setSelected(on: boolean): void {
    if (this.selected === on) return;
    this.selected = on;
    this.label.element.classList.toggle('selected', on);
    this.updateRingMaterial();
  }

  setHovered(on: boolean): void {
    this.hovered = on;
  }

  setLifted(on: boolean): void {
    this.lifted = on;
  }

  private updateRingMaterial(): void {
    if (!this.appearance) return;
    this.ring.material = this.selected
      ? this.assets.ringSelectedMat
      : this.assets.ringMaterial(this.appearance.ringColor, this.visibility === 'dim');
  }

  update(dtMs: number, timeMs: number): void {
    this.stepGlide(dtMs);
    const k = 1 - Math.exp(-dtMs / 60);
    this.lift += ((this.lifted ? LIFT_HEIGHT : 0) - this.lift) * k;
    this.figure.position.y = this.lift;
    const targetScale = this.hovered || this.lifted ? HOVER_SCALE : 1;
    this.scale += (targetScale - this.scale) * k;
    this.figure.scale.setScalar(this.scale);
    const pulse = this.selected ? 1 + Math.sin(timeMs / 180) * 0.06 : 1;
    this.ring.scale.set(pulse, 1, pulse);
  }

  private disposeNumber(): void {
    if (this.numberMat) {
      this.numberMat.map?.dispose();
      this.numberMat.dispose();
      this.numberMat = null;
    }
  }

  dispose(): void {
    this.disposeNumber();
    this.label.element.remove();
    this.root.removeFromParent();
  }
}
