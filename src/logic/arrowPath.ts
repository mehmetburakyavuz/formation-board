/** Pure 2D (ground plane x/z) helpers for directive arrows. */

export interface Pt {
  x: number;
  z: number;
}

const EPS = 1e-6;

function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, z: a.z - b.z };
}

function len(v: Pt): number {
  return Math.hypot(v.x, v.z);
}

function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

/** Unit perpendicular (left of the chord when looking from `from` to `to`). */
export function chordPerp(from: Pt, to: Pt): Pt {
  const d = sub(to, from);
  const l = len(d);
  if (l < EPS) return { x: 0, z: 1 };
  return { x: -d.z / l, z: d.x / l };
}

export function bezierControl(from: Pt, to: Pt, bend: number): Pt {
  const mid = lerpPt(from, to, 0.5);
  const n = chordPerp(from, to);
  return { x: mid.x + n.x * bend, z: mid.z + n.z * bend };
}

/** Point on the curve at t = 0.5, where the bend handle is shown. */
export function bendHandle(from: Pt, to: Pt, bend: number): Pt {
  const mid = lerpPt(from, to, 0.5);
  const n = chordPerp(from, to);
  return { x: mid.x + (n.x * bend) / 2, z: mid.z + (n.z * bend) / 2 };
}

/** Inverse of `bendHandle`: bend that puts the curve's midpoint closest to `p`. */
export function bendFromHandle(from: Pt, to: Pt, p: Pt): number {
  const mid = lerpPt(from, to, 0.5);
  const n = chordPerp(from, to);
  return 2 * ((p.x - mid.x) * n.x + (p.z - mid.z) * n.z);
}

/** Centre line: straight segment or sampled quadratic Bézier. */
export function arrowCenterline(from: Pt, to: Pt, bend: number, samples = 32): Pt[] {
  if (Math.abs(bend) < 1e-3) return [from, to];
  const c = bezierControl(from, to, bend);
  const pts: Pt[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    pts.push({
      x: u * u * from.x + 2 * u * t * c.x + t * t * to.x,
      z: u * u * from.z + 2 * u * t * c.z + t * t * to.z,
    });
  }
  return pts;
}

export function polylineLength(pts: readonly Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += len(sub(pts[i], pts[i - 1]));
  return l;
}

/** Point at arc length `s` from the start (clamped). */
export function pointAt(pts: readonly Pt[], s: number): Pt {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = len(sub(pts[i], pts[i - 1]));
    if (acc + seg >= s && seg > EPS) return lerpPt(pts[i - 1], pts[i], (s - acc) / seg);
    acc += seg;
  }
  return pts[pts.length - 1];
}

/** Sub-polyline between arc lengths `s0` and `s1`. */
export function slice(pts: readonly Pt[], s0: number, s1: number): Pt[] {
  if (s1 <= s0) return [];
  const out: Pt[] = [pointAt(pts, s0)];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += len(sub(pts[i], pts[i - 1]));
    if (acc > s0 && acc < s1) out.push(pts[i]);
  }
  out.push(pointAt(pts, s1));
  return out;
}

/** Removes `start` metres from the beginning and `end` metres from the end. */
export function trim(pts: readonly Pt[], start: number, end: number): Pt[] {
  const l = polylineLength(pts);
  return slice(pts, Math.max(0, start), Math.max(0, l - end));
}

/** Unit tangent at the end of the polyline. */
export function endTangent(pts: readonly Pt[]): Pt {
  for (let i = pts.length - 1; i > 0; i--) {
    const d = sub(pts[i], pts[i - 1]);
    const l = len(d);
    if (l > EPS) return { x: d.x / l, z: d.z / l };
  }
  return { x: 1, z: 0 };
}

/**
 * Wavy line along `pts` (dribble). The wave fades out over the last `calm` metres so the
 * arrow head sits on a straight piece.
 */
export function wave(pts: readonly Pt[], amplitude: number, wavelength: number, calm = 1.5): Pt[] {
  const total = polylineLength(pts);
  if (total < EPS) return [...pts];
  const step = wavelength / 10;
  const out: Pt[] = [];
  for (let s = 0; s <= total + 1e-9; s += step) {
    const p = pointAt(pts, s);
    const ahead = pointAt(pts, Math.min(total, s + 0.05));
    const behind = pointAt(pts, Math.max(0, s - 0.05));
    const t = sub(ahead, behind);
    const tl = len(t) || 1;
    const n = { x: -t.z / tl, z: t.x / tl };
    const fade = Math.min(1, Math.max(0, (total - s) / calm), s / 0.5);
    const off = Math.sin((s / wavelength) * Math.PI * 2) * amplitude * fade;
    out.push({ x: p.x + n.x * off, z: p.z + n.z * off });
  }
  const last = pts[pts.length - 1];
  // End exactly on the target (snap a nearly-equal last sample).
  if (len(sub(out[out.length - 1], last)) > EPS) out.push(last);
  else out[out.length - 1] = last;
  return out;
}

/** Splits a polyline into dash pieces. */
export function dashes(pts: readonly Pt[], dash: number, gap: number): Pt[][] {
  const total = polylineLength(pts);
  const out: Pt[][] = [];
  for (let s = 0; s < total; s += dash + gap) {
    const piece = slice(pts, s, Math.min(total, s + dash));
    if (piece.length >= 2) out.push(piece);
  }
  return out;
}

/** Shortest distance from `p` to the polyline. */
export function distanceToPolyline(p: Pt, pts: readonly Pt[]): number {
  if (pts.length === 1) return len(sub(p, pts[0]));
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const ab = sub(b, a);
    const l2 = ab.x * ab.x + ab.z * ab.z;
    const t =
      l2 < EPS ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.z - a.z) * ab.z) / l2));
    best = Math.min(best, len(sub(p, lerpPt(a, b, t))));
  }
  return best;
}

/** Is `p` inside the zone spanned by corners `a` and `b`? */
export function pointInZone(p: Pt, a: Pt, b: Pt, shape: 'rect' | 'ellipse'): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minZ = Math.min(a.z, b.z);
  const maxZ = Math.max(a.z, b.z);
  if (shape === 'rect') return p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ;
  const rx = (maxX - minX) / 2;
  const rz = (maxZ - minZ) / 2;
  if (rx < EPS || rz < EPS) return false;
  const dx = (p.x - (minX + maxX) / 2) / rx;
  const dz = (p.z - (minZ + maxZ) / 2) / rz;
  return dx * dx + dz * dz <= 1;
}
