import * as THREE from 'three';
import { HALF_LENGTH, HALF_WIDTH } from '../core/coords';

/** FIFA markings, metres. */
export const LINE_WIDTH = 0.12;
const CENTRE_CIRCLE_R = 9.15;
const PENALTY_DEPTH = 16.5;
const PENALTY_WIDTH = 40.32;
const GOAL_AREA_DEPTH = 5.5;
const GOAL_AREA_WIDTH = 18.32;
const PENALTY_SPOT = 11;
const CORNER_R = 1;
const SPOT_R = 0.15;

type P = [number, number]; // [x, z]

interface Polyline {
  points: P[];
  closed: boolean;
}

function arc(cx: number, cz: number, r: number, a0: number, a1: number, segs: number): P[] {
  const pts: P[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = a0 + ((a1 - a0) * i) / segs;
    pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return pts;
}

function collectPolylines(): Polyline[] {
  const L = HALF_LENGTH;
  const W = HALF_WIDTH;
  const lines: Polyline[] = [
    {
      points: [
        [-L, -W],
        [L, -W],
        [L, W],
        [-L, W],
      ],
      closed: true,
    },
    {
      points: [
        [0, -W],
        [0, W],
      ],
      closed: false,
    },
    { points: arc(0, 0, CENTRE_CIRCLE_R, 0, Math.PI * 2, 96).slice(0, -1), closed: true },
  ];

  for (const s of [-1, 1]) {
    const gx = s * L; // goal line x
    const box = (depth: number, width: number): Polyline => ({
      points: [
        [gx, -width / 2],
        [gx - s * depth, -width / 2],
        [gx - s * depth, width / 2],
        [gx, width / 2],
      ],
      closed: false,
    });
    lines.push(box(PENALTY_DEPTH, PENALTY_WIDTH), box(GOAL_AREA_DEPTH, GOAL_AREA_WIDTH));

    // Penalty arc: only the part outside the penalty area.
    const cx = gx - s * PENALTY_SPOT;
    const half = Math.acos((PENALTY_DEPTH - PENALTY_SPOT) / CENTRE_CIRCLE_R);
    const facing = s > 0 ? Math.PI : 0; // arc bulges towards the centre
    lines.push({
      points: arc(cx, 0, CENTRE_CIRCLE_R, facing - half, facing + half, 40),
      closed: false,
    });

    // Corner arcs.
    for (const t of [-1, 1]) {
      const cz = t * W;
      const a0 = Math.atan2(-t, 0);
      const a1 = Math.atan2(0, -s);
      let delta = a1 - a0;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      lines.push({ points: arc(gx, cz, CORNER_R, a0, a0 + delta, 12), closed: false });
    }
  }
  return lines;
}

/** Builds a flat constant-width strip (in XZ) for each polyline and merges them. */
function stripGeometry(lines: Polyline[], width: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const hw = width / 2;

  for (const { points, closed } of lines) {
    const n = points.length;
    const base = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const cur = points[i];
      const prev = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
      const next = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      const d1 = normalize([cur[0] - prev[0], cur[1] - prev[1]]);
      const d2 = normalize([next[0] - cur[0], next[1] - cur[1]]);
      const dirA = i === 0 && !closed ? d2 : d1;
      const dirB = i === n - 1 && !closed ? d1 : d2;
      const tangent = normalize([dirA[0] + dirB[0], dirA[1] + dirB[1]]);
      const normal: P = [-tangent[1], tangent[0]];
      const miter = 1 / Math.max(0.2, normal[0] * -dirA[1] + normal[1] * dirA[0]);
      const off = hw * miter;
      pos.push(cur[0] + normal[0] * off, 0, cur[1] + normal[1] * off);
      pos.push(cur[0] - normal[0] * off, 0, cur[1] - normal[1] * off);
    }
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = base + i * 2;
      const b = base + ((i + 1) % n) * 2;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  // Winding may vary per strip; force normals up for consistent lighting.
  geo.setAttribute('normal', upNormals(pos.length / 3));
  return geo;
}

function normalize(v: P): P {
  const len = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / len, v[1] / len];
}

function spotsGeometry(): THREE.BufferGeometry {
  const spots: P[] = [
    [0, 0],
    [-HALF_LENGTH + PENALTY_SPOT, 0],
    [HALF_LENGTH - PENALTY_SPOT, 0],
  ];
  const parts = spots.map(([x, z]) => {
    const g = new THREE.CircleGeometry(SPOT_R, 20);
    g.rotateX(-Math.PI / 2);
    g.translate(x, 0, z);
    return g;
  });
  const pos: number[] = [];
  const idx: number[] = [];
  for (const g of parts) {
    const base = pos.length / 3;
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
    const ix = g.getIndex();
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(base + ix.getX(i));
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.setAttribute('normal', upNormals(pos.length / 3));
  return geo;
}

function upNormals(count: number): THREE.Float32BufferAttribute {
  const n = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) n[i * 3 + 1] = 1;
  return new THREE.Float32BufferAttribute(n, 3);
}

export function createPitchLines(): THREE.Group {
  const material = new THREE.MeshStandardMaterial({
    color: 0xf4f6f2,
    roughness: 0.7,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const group = new THREE.Group();
  group.name = 'pitch-lines';
  const lines = new THREE.Mesh(stripGeometry(collectPolylines(), LINE_WIDTH), material);
  const spots = new THREE.Mesh(spotsGeometry(), material);
  for (const m of [lines, spots]) {
    m.position.y = 0.01;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}
