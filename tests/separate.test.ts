import { describe, expect, it } from 'vitest';
import { separate } from '../src/logic/separate';

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

describe('separate', () => {
  it('leaves pieces that are far enough apart untouched', () => {
    const moved = new Map([['a', { x: 0, z: 0 }]]);
    const out = separate(moved, [{ id: 'b', x: 5, z: 0 }], 0.8);
    expect(out.get('a')).toEqual({ x: 0, z: 0 });
  });

  it('pushes a dropped piece away from a static one to the minimum distance', () => {
    const moved = new Map([['a', { x: 0.3, z: 0 }]]);
    const out = separate(moved, [{ id: 'b', x: 0, z: 0 }], 0.8);
    const a = out.get('a');
    expect(a).toBeDefined();
    if (!a) return;
    expect(dist(a, { x: 0, z: 0 })).toBeCloseTo(0.8, 5);
    expect(a.z).toBeCloseTo(0);
  });

  it('handles exact overlap deterministically', () => {
    const moved = new Map([['a', { x: 1, z: 1 }]]);
    const out = separate(moved, [{ id: 'b', x: 1, z: 1 }], 0.8);
    const a = out.get('a');
    expect(a && dist(a, { x: 1, z: 1 })).toBeGreaterThanOrEqual(0.8 - 1e-9);
  });

  it('ignores the moved piece itself in the statics list', () => {
    const moved = new Map([['a', { x: 0, z: 0 }]]);
    const out = separate(moved, [{ id: 'a', x: 0.1, z: 0 }], 0.8);
    expect(out.get('a')).toEqual({ x: 0, z: 0 });
  });

  it('never moves static pieces and resolves crowded drops', () => {
    const statics = [
      { id: 's1', x: 0, z: 0 },
      { id: 's2', x: 1, z: 0 },
    ];
    const moved = new Map([['a', { x: 0.5, z: 0.1 }]]);
    const out = separate(moved, statics, 0.8, 20);
    const a = out.get('a');
    expect(a).toBeDefined();
    if (!a) return;
    for (const s of statics) expect(dist(a, s)).toBeGreaterThanOrEqual(0.8 - 1e-3);
  });
});
