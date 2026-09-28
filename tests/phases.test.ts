import { describe, expect, it } from 'vitest';
import { FORMATIONS } from '../src/data/formations';
import { deriveDefence, DEFENCE_DEPTH_FACTOR, DEFENCE_WIDTH_FACTOR } from '../src/logic/phases';

describe('deriveDefence', () => {
  it('keeps the goalkeeper where he is', () => {
    expect(deriveDefence({ nx: 0.05, ny: 0.5 }, 'GK')).toEqual({ nx: 0.05, ny: 0.5 });
  });

  it('drops outfield players towards their own goal', () => {
    const d = deriveDefence({ nx: 0.62, ny: 0.4 }, 'LS');
    expect(d.nx).toBeCloseTo(0.62 * DEFENCE_DEPTH_FACTOR);
    expect(d.nx).toBeLessThan(0.62);
  });

  it('narrows towards the centre and keeps the centre fixed', () => {
    expect(deriveDefence({ nx: 0.4, ny: 0.5 }, 'CM').ny).toBeCloseTo(0.5);
    const left = deriveDefence({ nx: 0.25, ny: 0.12 }, 'LB');
    expect(left.ny).toBeCloseTo(0.5 + (0.12 - 0.5) * DEFENCE_WIDTH_FACTOR);
    expect(left.ny).toBeGreaterThan(0.12);
    const right = deriveDefence({ nx: 0.25, ny: 0.88 }, 'RB');
    expect(right.ny).toBeLessThan(0.88);
  });

  it('makes every preset formation more compact (depth and width)', () => {
    for (const f of FORMATIONS) {
      const outfield = f.slots.filter((s) => s.role !== 'GK');
      const def = outfield.map((s) => deriveDefence(s, s.role));
      const span = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
      expect(span(def.map((p) => p.nx))).toBeLessThan(span(outfield.map((p) => p.nx)));
      expect(span(def.map((p) => p.ny))).toBeLessThan(span(outfield.map((p) => p.ny)));
      // Stays on the pitch.
      for (const p of def) {
        expect(p.nx).toBeGreaterThanOrEqual(0);
        expect(p.ny).toBeGreaterThanOrEqual(0);
        expect(p.ny).toBeLessThanOrEqual(1);
      }
    }
  });
});
