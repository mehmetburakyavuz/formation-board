import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { BODY_CENTER_Y, FIGURE_HEIGHT, HEAD_Y, NUMBER_Y, type PlayerAssets } from './PlayerAssets';

export interface PlayerAppearance {
  number: number;
  label: string;
  bodyColor: string;
  numberColor: string;
  ringColor: string;
  /** +1 faces +X (home attack direction), -1 faces -X. */
  facing: 1 | -1;
}

const LIFT_HEIGHT = 0.3;
const HOVER_SCALE = 1.05;

/** Stylised player figure: capsule body, head, shirt numbers, ground ring and label. */
export class PlayerMesh {
  readonly root = new THREE.Group();
  readonly hit: THREE.Mesh;
  private figure = new THREE.Group();
  private body: THREE.Mesh;
  private ring: THREE.Mesh;
  private numberMat: THREE.MeshStandardMaterial | null = null;
  private numberFront: THREE.Mesh;
  private numberBack: THREE.Mesh;
  private label: CSS2DObject;
  private labelNum: HTMLSpanElement;
  private labelName: HTMLSpanElement;
  private appearance: PlayerAppearance | null = null;

  private selected = false;
  private hovered = false;
  private lifted = false;
  private lift = 0;
  private scale = 1;

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

    const labelEl = document.createElement('div');
    labelEl.className = 'player-label';
    this.labelNum = document.createElement('span');
    this.labelNum.className = 'num';
    this.labelName = document.createElement('span');
    this.labelName.className = 'name';
    labelEl.append(this.labelNum, this.labelName);
    this.label = new CSS2DObject(labelEl);
    this.label.position.y = FIGURE_HEIGHT + 0.35;
    this.label.center.set(0.5, 1);

    this.figure.add(this.label);
    this.root.add(this.figure, this.ring, this.hit);
  }

  setPosition(x: number, z: number): void {
    this.root.position.set(x, 0, z);
  }

  setAppearance(a: PlayerAppearance): void {
    const prev = this.appearance;
    this.appearance = a;
    this.body.material = this.assets.bodyMaterial(a.bodyColor);
    if (!prev || prev.number !== a.number || prev.numberColor !== a.numberColor) {
      this.disposeNumber();
      this.numberMat = this.assets.createNumberMaterial(a.number, a.numberColor);
      this.numberFront.material = this.numberMat;
      this.numberBack.material = this.numberMat;
    }
    this.figure.rotation.y = a.facing === 1 ? 0 : Math.PI;
    this.labelNum.textContent = String(a.number);
    this.labelName.textContent = a.label;
    this.labelNum.style.background = a.bodyColor;
    this.labelNum.style.color = a.numberColor;
    this.updateRingMaterial();
  }

  setLabelVisible(visible: boolean): void {
    this.label.visible = visible;
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
      : this.assets.ringMaterial(this.appearance.ringColor);
  }

  update(dtMs: number, timeMs: number): void {
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
