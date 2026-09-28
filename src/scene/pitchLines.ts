import * as THREE from 'three';
import { HALF_LENGTH, HALF_WIDTH } from '../core/coords';
import { FlatGeometryBuilder, type P } from './flatGeometry';

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
  const normals = new Float32Array(pos.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

function linesGeometry(): THREE.BufferGeometry {
  const b = new FlatGeometryBuilder();
  for (const l of collectPolylines()) b.strip(l.points, LINE_WIDTH, l.closed);
  return b.build();
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
  const lines = new THREE.Mesh(linesGeometry(), material);
  const spots = new THREE.Mesh(spotsGeometry(), material);
  for (const m of [lines, spots]) {
    m.position.y = 0.01;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}
