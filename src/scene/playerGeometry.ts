import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Procedural footballer figure (no external model). Built from simple primitives,
 * merged per rigid body part and coloured with vertex colours, so one kit is a
 * handful of shared geometries and a player costs ~7 draw calls.
 *
 * Figure stands on y = 0 and faces +X; +Z is its right-hand side.
 */

export interface KitColors {
  shirt: string;
  shorts: string;
  socks: string;
}

export interface FigureGeometries {
  /** Hips, shorts, shirt, neck and head; pivots at the hips (for leaning). */
  torso: THREE.BufferGeometry;
  /** Sleeve, arm and hand; pivots at the shoulder. */
  arm: THREE.BufferGeometry;
  /** Shorts leg and thigh; pivots at the hip joint. */
  thigh: THREE.BufferGeometry;
  /** Knee, sock and boot; pivots at the knee. */
  shin: THREE.BufferGeometry;
}

export const HIP_Y = 0.97;
export const HIP_Z = 0.1;
export const THIGH_LENGTH = 0.45;
export const SHOULDER_Y = 1.43;
export const SHOULDER_Z = 0.245;
export const HEAD_Y = 1.69;
export const FIGURE_HEIGHT = 1.84;

/** Depth / width ratio of the chest and hip cross-sections. */
const TORSO_DEPTH = 0.62;
const FOREARM_BEND = 0.45;
const SKIN = '#c99a74';
const HAIR = '#2b2018';
const BOOT = '#161616';

type Profile = readonly (readonly [radius: number, y: number])[];

const SHORTS_PROFILE: Profile = [
  [0.165, 0.84],
  [0.18, 0.9],
  [0.185, 0.98],
  [0.18, 1.02],
];

const SHIRT_PROFILE: Profile = [
  [0.2, 0.94],
  [0.195, 1.02],
  [0.198, 1.12],
  [0.215, 1.28],
  [0.235, 1.38],
  [0.225, 1.44],
  [0.17, 1.49],
  [0.07, 1.52],
];

const SOCK_PROFILE: Profile = [
  [0.058, -0.02],
  [0.064, -0.12],
  [0.058, -0.24],
  [0.043, -0.38],
  [0.04, -0.45],
];

function paint(geo: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = geo.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geo = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  if (!geo) throw new Error('player geometry merge failed');
  return geo;
}

function lathe(
  profile: Profile,
  depth: number,
  segments = 20,
  phiStart = 0,
  phiLength = Math.PI * 2,
): THREE.BufferGeometry {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, segments, phiStart, phiLength).scale(depth, 1, 1);
}

function sphere(r: number, x: number, y: number, z = 0): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, 12, 8).translate(x, y, z);
}

/** Cylinder whose top is at `top` and bottom at `bottom` (local Y). */
function limb(rTop: number, rBottom: number, top: number, bottom: number): THREE.BufferGeometry {
  const h = top - bottom;
  return new THREE.CylinderGeometry(rTop, rBottom, h, 12).translate(0, bottom + h / 2, 0);
}

function buildTorso(kit: KitColors): THREE.BufferGeometry {
  const head = new THREE.SphereGeometry(0.115, 18, 12).scale(1.05, 1.12, 0.92);
  const hair = new THREE.SphereGeometry(0.121, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)
    .scale(1.05, 1.12, 0.94)
    .rotateZ(0.4);
  const parts = [
    paint(lathe(SHORTS_PROFILE, TORSO_DEPTH), kit.shorts),
    paint(lathe(SHIRT_PROFILE, TORSO_DEPTH), kit.shirt),
    paint(limb(0.05, 0.056, 1.62, 1.48), SKIN),
    paint(head.translate(0.01, HEAD_Y, 0), SKIN),
    paint(hair.translate(0.005, HEAD_Y + 0.004, 0), HAIR),
    paint(sphere(0.026, 0, HEAD_Y, 0.112), SKIN),
    paint(sphere(0.026, 0, HEAD_Y, -0.112), SKIN),
  ];
  return merge(parts).translate(0, -HIP_Y, 0);
}

function buildArm(kit: KitColors): THREE.BufferGeometry {
  const elbowY = -0.31;
  const forearmLength = 0.25;
  const forearm = limb(0.04, 0.033, 0, -forearmLength)
    .rotateZ(FOREARM_BEND)
    .translate(0, elbowY, 0);
  const handDist = forearmLength + 0.035;
  const hand = new THREE.SphereGeometry(0.042, 10, 8)
    .scale(0.8, 1.2, 0.65)
    .rotateZ(FOREARM_BEND)
    .translate(Math.sin(FOREARM_BEND) * handDist, elbowY - Math.cos(FOREARM_BEND) * handDist, 0);
  return merge([
    paint(new THREE.SphereGeometry(0.074, 12, 8).scale(1, 0.9, 1), kit.shirt),
    paint(limb(0.07, 0.058, 0.01, -0.2), kit.shirt),
    paint(limb(0.048, 0.042, -0.17, elbowY), SKIN),
    paint(sphere(0.042, 0, elbowY), SKIN),
    paint(forearm, SKIN),
    paint(hand, SKIN),
  ]);
}

function buildThigh(kit: KitColors): THREE.BufferGeometry {
  return merge([
    paint(limb(0.098, 0.106, 0.02, -0.22), kit.shorts),
    paint(limb(0.08, 0.06, -0.2, -THIGH_LENGTH), SKIN),
  ]);
}

function buildShin(kit: KitColors): THREE.BufferGeometry {
  // Knee is at HIP_Y - THIGH_LENGTH; the boot sole touches y = 0 in the rest pose.
  const soleY = -(HIP_Y - THIGH_LENGTH);
  const boot = new THREE.CapsuleGeometry(0.046, 0.16, 4, 10)
    .rotateZ(Math.PI / 2)
    .scale(1, 0.85, 1.05)
    .translate(0.045, soleY + 0.046 * 0.85, 0);
  return merge([
    paint(sphere(0.062, 0, 0), SKIN),
    paint(lathe(SOCK_PROFILE, 1, 14), kit.socks),
    paint(boot, BOOT),
  ]);
}

export function buildFigure(kit: KitColors): FigureGeometries {
  return {
    torso: buildTorso(kit),
    arm: buildArm(kit),
    thigh: buildThigh(kit),
    shin: buildShin(kit),
  };
}

/** Shirt radius (before the depth squash) at height y, interpolated from the profile. */
function shirtRadius(y: number): number {
  const p = SHIRT_PROFILE;
  for (let i = 1; i < p.length; i++) {
    const [r1, y1] = p[i];
    const [r0, y0] = p[i - 1];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return p[p.length - 1][0];
}

/**
 * A patch that hugs the shirt around the front (+X) between two heights, for the
 * number texture (u across, v up). Rotate by PI for the back. Local to the torso pivot.
 */
export function buildNumberPatch(yMin: number, yMax: number, arc: number): THREE.BufferGeometry {
  const rows = 6;
  const profile: [number, number][] = [];
  for (let i = 0; i <= rows; i++) {
    const y = yMin + ((yMax - yMin) * i) / rows;
    profile.push([shirtRadius(y) + 0.008, y]);
  }
  return lathe(profile, TORSO_DEPTH, 10, Math.PI / 2 - arc / 2, arc).translate(0, -HIP_Y, 0);
}
