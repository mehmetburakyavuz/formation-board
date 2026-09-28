import * as THREE from 'three';

/** [x, z] on the ground plane. */
export type P = [number, number];

function normalize(v: P): P {
  const len = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / len, v[1] / len];
}

/**
 * Accumulates flat (y = 0, normal up) triangles: constant-width strips along polylines
 * with mitred joins, plus loose triangles/fans. Used for pitch markings and arrows.
 */
export class FlatGeometryBuilder {
  private pos: number[] = [];
  private idx: number[] = [];

  get empty(): boolean {
    return this.idx.length === 0;
  }

  strip(points: readonly P[], width: number, closed = false): this {
    const n = points.length;
    if (n < 2) return this;
    const hw = width / 2;
    const base = this.pos.length / 3;
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
      this.pos.push(cur[0] + normal[0] * off, 0, cur[1] + normal[1] * off);
      this.pos.push(cur[0] - normal[0] * off, 0, cur[1] - normal[1] * off);
    }
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = base + i * 2;
      const b = base + ((i + 1) % n) * 2;
      this.idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return this;
  }

  triangle(a: P, b: P, c: P): this {
    const base = this.pos.length / 3;
    for (const p of [a, b, c]) this.pos.push(p[0], 0, p[1]);
    this.idx.push(base, base + 1, base + 2);
    return this;
  }

  /** Convex polygon as a triangle fan. */
  fan(points: readonly P[]): this {
    for (let i = 1; i < points.length - 1; i++) this.triangle(points[0], points[i], points[i + 1]);
    return this;
  }

  build(target?: THREE.BufferGeometry): THREE.BufferGeometry {
    const geo = target ?? new THREE.BufferGeometry();
    const count = this.pos.length / 3;
    const normals = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) normals[i * 3 + 1] = 1;
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    // Winding varies; normals are forced up for consistent lighting (materials are double-sided).
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(this.idx);
    geo.computeBoundingSphere();
    return geo;
  }
}
