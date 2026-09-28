import * as THREE from 'three';
import type { RunGait } from './motion';
import {
  HIP_Y,
  HIP_Z,
  SHOULDER_Y,
  SHOULDER_Z,
  THIGH_LENGTH,
  type FigureGeometries,
} from './playerGeometry';

/** Resting arm spread (radians) so the hands hang clear of the hips. */
const ARM_SPREAD = 0.09;

interface Leg {
  thigh: THREE.Mesh;
  shin: THREE.Mesh;
}

/**
 * The articulated figure: rigid parts on pivots (waist, shoulders, hips, knees).
 * `pose()` swings them from a RunGait; at rest it is a relaxed standing pose.
 * Local frame: stands on y = 0, faces +X, +Z is the right-hand side.
 */
export class PlayerRig {
  readonly root = new THREE.Group();
  /** Everything above the hips; leans forward when running. */
  readonly upper = new THREE.Group();
  private torso: THREE.Mesh;
  private arms: [left: THREE.Mesh, right: THREE.Mesh];
  private legs: [left: Leg, right: Leg];
  private meshes: THREE.Mesh[];

  constructor(geo: FigureGeometries, material: THREE.Material) {
    this.upper.position.y = HIP_Y;
    this.torso = new THREE.Mesh(geo.torso, material);
    this.upper.add(this.torso);

    const arm = (side: 1 | -1) => {
      const m = new THREE.Mesh(geo.arm, material);
      m.position.set(0, SHOULDER_Y - HIP_Y, side * SHOULDER_Z);
      m.rotation.x = -side * ARM_SPREAD;
      this.upper.add(m);
      return m;
    };
    this.arms = [arm(-1), arm(1)];

    const leg = (side: 1 | -1): Leg => {
      const thigh = new THREE.Mesh(geo.thigh, material);
      thigh.position.set(0, HIP_Y, side * HIP_Z);
      const shin = new THREE.Mesh(geo.shin, material);
      shin.position.y = -THIGH_LENGTH;
      thigh.add(shin);
      this.root.add(thigh);
      return { thigh, shin };
    };
    this.legs = [leg(-1), leg(1)];
    this.root.add(this.upper);

    this.meshes = [this.torso, ...this.arms, ...this.legs.flatMap((l) => [l.thigh, l.shin])];
    for (const m of this.meshes) m.castShadow = true;
  }

  setGeometry(geo: FigureGeometries): void {
    this.torso.geometry = geo.torso;
    for (const a of this.arms) a.geometry = geo.arm;
    for (const l of this.legs) {
      l.thigh.geometry = geo.thigh;
      l.shin.geometry = geo.shin;
    }
  }

  setMaterial(material: THREE.Material, castShadow: boolean): void {
    for (const m of this.meshes) {
      m.material = material;
      m.castShadow = castShadow;
    }
  }

  /** Limb angles for the current gait (rotation about Z swings in the running plane). */
  pose(g: RunGait): void {
    const a = g.amount;
    const s = Math.sin(g.phase);
    const c = Math.cos(g.phase);
    const [left, right] = this.legs;
    // Thighs swing opposite; the knee folds while its leg comes forward.
    left.thigh.rotation.z = a * 0.7 * s;
    right.thigh.rotation.z = -a * 0.7 * s;
    left.shin.rotation.z = -a * (0.15 + 1.25 * Math.max(0, c));
    right.shin.rotation.z = -a * (0.15 + 1.25 * Math.max(0, -c));
    // Arms counter the legs on the same side.
    this.arms[0].rotation.z = -a * 0.75 * s;
    this.arms[1].rotation.z = a * 0.75 * s;
    // Lean into the run, shoulders counter-rotate, hips dip as the legs spread.
    this.upper.rotation.z = -a * 0.16;
    this.upper.rotation.y = a * 0.12 * s;
    this.root.position.y = a * (0.03 - 0.1 * Math.abs(s));
  }
}
