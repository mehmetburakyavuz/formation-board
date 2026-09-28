import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { DIM_OPACITY, type PlayerAssets } from './PlayerAssets';
import { approachAngle, DropBounce, Glide, RunGait } from './motion';
import { FIGURE_HEIGHT, type KitColors } from './playerGeometry';
import { PlayerRig } from './PlayerRig';

export type PlayerVisibility = 'normal' | 'dim' | 'hidden';

export interface PlayerAppearance {
  number: number;
  label: string;
  /** Instruction badge texts shown under the label. */
  badges: readonly string[];
  /** Shirt colour (also used for the label's number chip). */
  bodyColor: string;
  kit: KitColors;
  numberColor: string;
  ringColor: string;
  /** +1 faces +X (home attack direction), -1 faces -X. */
  facing: 1 | -1;
}

const LIFT_HEIGHT = 0.3;

const HOVER_SCALE = 1.05;

/** Stylised, procedurally built footballer: kit, shirt numbers, run cycle, ground ring and label. */
export class PlayerMesh {
  readonly root = new THREE.Group();
  readonly hit: THREE.Mesh;
  private figure = new THREE.Group();
  private rig: PlayerRig;
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
  private glide = new Glide(this.root);
  private bounce = new DropBounce();
  private gait = new RunGait();
  /** Figure yaw (radians); 0 = facing +X. */
  private heading = 0;
  private headingTarget = 0;
  private headingInit = false;
  private povHidden = false;

  constructor(
    readonly id: string,
    private assets: PlayerAssets,
  ) {
    this.root.name = `player:${id}`;

    this.rig = new PlayerRig(assets.blankFigure, assets.kitMat);
    // Numbers ride on the upper body so they lean with it.
    this.numberFront = new THREE.Mesh(assets.numberFrontGeo, assets.hitMat);
    this.numberBack = new THREE.Mesh(assets.numberBackGeo, assets.hitMat);
    this.numberBack.rotation.y = Math.PI;
    this.rig.upper.add(this.numberFront, this.numberBack);

    this.figure.add(this.rig.root);

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
    this.glide.stop();
    this.root.position.set(x, 0, z);
  }

  /** Glide from the current visual position to (x, z), easeInOutCubic. */
  glideTo(x: number, z: number, durationMs: number, delayMs: number): void {
    this.glide.start(x, z, durationMs, delayMs);
  }

  /** Direction the figure should face (yaw, radians; 0 = +X). Turns smoothly. */
  setHeading(yaw: number): void {
    this.headingTarget = yaw;
    if (!this.headingInit) {
      this.headingInit = true;
      this.heading = yaw;
    }
  }

  /** Hides the figure while the camera is inside this player's eyes. */
  setPovHidden(on: boolean): void {
    this.povHidden = on;
    this.applyVisible();
  }

  private applyVisible(): void {
    const shown = this.visibility !== 'hidden' && !this.povHidden;
    this.root.visible = shown;
    this.label.visible = this.labelVisible && shown;
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
    this.rig.setGeometry(this.assets.figure(a.kit));
    this.applyMaterials();
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
    this.applyVisible();
  }

  /** Normal, faded (translucent) or hidden — used for the opponent team. */
  setVisibility(v: PlayerVisibility): void {
    if (this.visibility === v) return;
    this.visibility = v;
    this.applyVisible();
    this.label.element.classList.toggle('dim', v === 'dim');
    this.applyMaterials();
  }

  private applyMaterials(): void {
    const a = this.appearance;
    if (!a) return;
    const dim = this.visibility === 'dim';
    this.rig.setMaterial(dim ? this.assets.kitDimMat : this.assets.kitMat, !dim);
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
    if (this.lifted && !on) this.bounce.trigger();
    this.lifted = on;
  }

  private updateRingMaterial(): void {
    if (!this.appearance) return;
    this.ring.material = this.selected
      ? this.assets.ringSelectedMat
      : this.assets.ringMaterial(this.appearance.ringColor, this.visibility === 'dim');
  }

  update(dtMs: number, timeMs: number): void {
    this.glide.step(dtMs);
    const k = 1 - Math.exp(-dtMs / 60);
    this.lift += ((this.lifted ? LIFT_HEIGHT : 0) - this.lift) * k;
    this.figure.position.y = this.lift;
    const targetScale = this.hovered || this.lifted ? HOVER_SCALE : 1;
    this.scale += (targetScale - this.scale) * k;
    const [sxz, sy] = this.bounce.step(dtMs);
    this.figure.scale.set(this.scale * sxz, this.scale * sy, this.scale * sxz);
    // Run towards where the player is going; face the tactical heading once there.
    const p = this.root.position;
    this.gait.step(p.x, p.z, dtMs, this.lifted);
    this.rig.pose(this.gait);
    const target = this.gait.amount > 0.3 ? this.gait.moveYaw : this.headingTarget;
    this.heading = approachAngle(this.heading, target, dtMs, 140);
    this.figure.rotation.y = this.heading;
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
