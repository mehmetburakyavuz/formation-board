import * as THREE from 'three';
import {
  arrowCenterline,
  dashes,
  endTangent,
  polylineLength,
  trim,
  wave,
  type Pt,
} from '../../logic/arrowPath';
import type { ArrowStyle } from '../../state/schema';
import { FlatGeometryBuilder, type P } from '../flatGeometry';

const Y = 0.025;
const BODY_WIDTH = 0.34;
const SHADOW_EXTRA = 0.18;
const HEAD_LENGTH = 1.7;
const HEAD_HALF_WIDTH = 0.75;
const DASH = 1.3;
const GAP = 0.8;
const WAVE_AMPLITUDE = 0.45;
const WAVE_LENGTH = 2.2;

export interface ArrowInput {
  from: Pt;
  to: Pt;
  bend: number;
  style: ArrowStyle;
  color: string;
  /** Metres cut from each end (e.g. to clear a player's ring). */
  trimStart: number;
  trimEnd: number;
  highlighted: boolean;
}

function toP(p: Pt): P {
  return [p.x, p.z];
}

function sameInput(a: ArrowInput | null, b: ArrowInput): boolean {
  if (!a) return false;
  const near = (u: number, v: number) => Math.abs(u - v) < 1e-4;
  return (
    near(a.from.x, b.from.x) &&
    near(a.from.z, b.from.z) &&
    near(a.to.x, b.to.x) &&
    near(a.to.z, b.to.z) &&
    near(a.bend, b.bend) &&
    a.style === b.style &&
    a.color === b.color &&
    a.trimStart === b.trimStart &&
    a.trimEnd === b.trimEnd &&
    a.highlighted === b.highlighted
  );
}

/** Flat ribbon arrow on the ground: solid (run), dashed (pass) or wavy (dribble). */
export class ArrowView {
  readonly group = new THREE.Group();
  /** Centre line of the visible arrow (world x/z), for hit testing. */
  centerline: Pt[] = [];
  private body: THREE.Mesh;
  private shadow: THREE.Mesh;
  private material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -6,
  });
  private shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -5,
  });
  private last: ArrowInput | null = null;

  constructor(readonly id: string) {
    this.body = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.shadow = new THREE.Mesh(new THREE.BufferGeometry(), this.shadowMat);
    this.body.position.y = Y + 0.002;
    this.shadow.position.y = Y;
    this.body.renderOrder = 4;
    this.shadow.renderOrder = 3;
    this.group.add(this.shadow, this.body);
  }

  /** Rebuilds geometry only when the input changed. */
  update(input: ArrowInput): void {
    if (sameInput(this.last, input)) return;
    this.last = { ...input, from: { ...input.from }, to: { ...input.to } };
    this.material.color.set(input.color);
    this.material.opacity = input.highlighted ? 1 : 0.92;

    const path = trim(
      arrowCenterline(input.from, input.to, input.bend),
      input.trimStart,
      input.trimEnd,
    );
    this.centerline = path;
    const length = polylineLength(path);
    const bodyB = new FlatGeometryBuilder();
    const shadowB = new FlatGeometryBuilder();
    if (length > 0.2) {
      const headLen = Math.min(HEAD_LENGTH, length * 0.5);
      const halfW = HEAD_HALF_WIDTH * (headLen / HEAD_LENGTH);
      const tip = path[path.length - 1];
      const t = endTangent(path);
      const baseC = { x: tip.x - t.x * headLen, z: tip.z - t.z * headLen };
      const n = { x: -t.z, z: t.x };
      const head: [P, P, P] = [
        toP(tip),
        [baseC.x + n.x * halfW, baseC.z + n.z * halfW],
        [baseC.x - n.x * halfW, baseC.z - n.z * halfW],
      ];

      // Body stops just inside the head base so they join without a gap.
      let bodyPath = trim(path, 0, headLen * 0.85);
      if (input.style === 'dribble') bodyPath = wave(bodyPath, WAVE_AMPLITUDE, WAVE_LENGTH, 1.2);
      const pieces = input.style === 'pass' ? dashes(bodyPath, DASH, GAP) : [bodyPath];
      for (const piece of pieces) {
        const pts = piece.map(toP);
        bodyB.strip(pts, BODY_WIDTH);
        shadowB.strip(pts, BODY_WIDTH + SHADOW_EXTRA);
      }
      bodyB.triangle(...head);
      const s = 1 + SHADOW_EXTRA / HEAD_HALF_WIDTH / 2;
      shadowB.triangle(
        [tip.x + t.x * 0.12, tip.z + t.z * 0.12],
        [baseC.x + n.x * halfW * s - t.x * 0.08, baseC.z + n.z * halfW * s - t.z * 0.08],
        [baseC.x - n.x * halfW * s - t.x * 0.08, baseC.z - n.z * halfW * s - t.z * 0.08],
      );
    }
    bodyB.build(this.body.geometry);
    shadowB.build(this.shadow.geometry);
  }

  dispose(): void {
    this.body.geometry.dispose();
    this.shadow.geometry.dispose();
    this.material.dispose();
    this.shadowMat.dispose();
    this.group.removeFromParent();
  }
}
