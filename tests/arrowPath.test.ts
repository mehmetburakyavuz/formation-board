import { describe, expect, it } from 'vitest';
import {
  arrowCenterline,
  bendFromHandle,
  bendHandle,
  dashes,
  distanceToPolyline,
  endTangent,
  pointInZone,
  polylineLength,
  trim,
  wave,
} from '../src/logic/arrowPath';

const A = { x: 0, z: 0 };
const B = { x: 10, z: 0 };

describe('arrowPath', () => {
  it('is a straight segment without bend', () => {
    expect(arrowCenterline(A, B, 0)).toEqual([A, B]);
  });

  it('bends to the left for positive bend and passes through the handle', () => {
    const pts = arrowCenterline(A, B, 4, 32);
    expect(pts[0]).toEqual(A);
    expect(pts[pts.length - 1]).toEqual(B);
    const mid = pts[16];
    const h = bendHandle(A, B, 4);
    expect(mid.x).toBeCloseTo(h.x);
    expect(mid.z).toBeCloseTo(h.z);
    expect(h.z).toBeCloseTo(2); // left of +X is +Z, curve midpoint = bend / 2
  });

  it('bendFromHandle inverts bendHandle', () => {
    for (const bend of [-6, -1, 0, 2.5, 9]) {
      expect(bendFromHandle(A, B, bendHandle(A, B, bend))).toBeCloseTo(bend);
    }
  });

  it('trims both ends by arc length', () => {
    const t = trim([A, B], 1, 2);
    expect(t[0].x).toBeCloseTo(1);
    expect(t[t.length - 1].x).toBeCloseTo(8);
    expect(polylineLength(t)).toBeCloseTo(7);
  });

  it('returns an empty polyline when trimmed away', () => {
    expect(trim([A, B], 6, 6)).toEqual([]);
  });

  it('end tangent points along the last segment', () => {
    expect(endTangent([A, B])).toEqual({ x: 1, z: 0 });
  });

  it('splits into dashes with gaps', () => {
    const d = dashes([A, B], 1, 1);
    expect(d.length).toBe(5);
    for (const piece of d) expect(polylineLength(piece)).toBeCloseTo(1);
  });

  it('wave keeps the end point and stays within the amplitude', () => {
    const w = wave([A, B], 0.4, 2);
    expect(w[w.length - 1]).toEqual(B);
    for (const p of w) expect(Math.abs(p.z)).toBeLessThanOrEqual(0.4 + 1e-9);
    // Calm near the end so the head sits on a straight piece.
    const tail = w.filter((p) => p.x > 9.8);
    for (const p of tail) expect(Math.abs(p.z)).toBeLessThan(0.1);
  });

  it('measures distance to a polyline', () => {
    expect(distanceToPolyline({ x: 5, z: 3 }, [A, B])).toBeCloseTo(3);
    expect(distanceToPolyline({ x: -4, z: 3 }, [A, B])).toBeCloseTo(5);
  });

  it('hit-tests rectangle and ellipse zones', () => {
    const a = { x: 0, z: 0 };
    const b = { x: 10, z: 4 };
    expect(pointInZone({ x: 9.5, z: 3.5 }, a, b, 'rect')).toBe(true);
    expect(pointInZone({ x: 9.5, z: 3.5 }, a, b, 'ellipse')).toBe(false);
    expect(pointInZone({ x: 5, z: 2 }, b, a, 'ellipse')).toBe(true);
    expect(pointInZone({ x: 11, z: 2 }, a, b, 'rect')).toBe(false);
  });
});
