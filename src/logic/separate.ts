import type { GroundPoint } from '../core/coords';

export interface Body {
  id: string;
  x: number;
  z: number;
}

/**
 * Pushes the `moved` bodies away from every other body (and from each other)
 * until no pair is closer than `minDist`. Static bodies never move.
 * Returns new positions for the moved bodies. Pure.
 */
export function separate(
  moved: ReadonlyMap<string, GroundPoint>,
  statics: readonly Body[],
  minDist: number,
  iterations = 8,
): Map<string, GroundPoint> {
  const out = new Map<string, GroundPoint>();
  for (const [id, p] of moved) out.set(id, { x: p.x, z: p.z });
  const fixed = statics.filter((b) => !moved.has(b.id));
  const ids = [...out.keys()];

  for (let it = 0; it < iterations; it++) {
    let changed = false;
    for (const id of ids) {
      const p = out.get(id);
      if (!p) continue;
      const push = (ox: number, oz: number, share: number) => {
        const dx = p.x - ox;
        const dz = p.z - oz;
        const d = Math.hypot(dx, dz);
        if (d >= minDist) return;
        changed = true;
        if (d < 1e-6) {
          // Exactly overlapping: pick a deterministic direction.
          p.x += minDist * share;
          return;
        }
        const k = ((minDist - d) * share) / d;
        p.x += dx * k;
        p.z += dz * k;
      };
      for (const b of fixed) push(b.x, b.z, 1);
      for (const other of ids) {
        if (other === id) continue;
        const q = out.get(other);
        // Moved pieces share the correction equally.
        if (q) push(q.x, q.z, 0.5);
      }
    }
    if (!changed) break;
  }
  return out;
}
