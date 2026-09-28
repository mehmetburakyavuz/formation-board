import { describe, expect, it } from 'vitest';
import {
  clampToPitch,
  HALF_LENGTH,
  HALF_WIDTH,
  normalizedToWorld,
  worldToNormalized,
  type Side,
} from '../src/core/coords';

describe('coords', () => {
  it('maps home corners and centre', () => {
    expect(normalizedToWorld({ nx: 0.5, ny: 0.5 }, 'home')).toEqual({ x: 0, z: 0 });
    expect(normalizedToWorld({ nx: 0, ny: 0 }, 'home')).toEqual({
      x: -HALF_LENGTH,
      z: -HALF_WIDTH,
    });
    expect(normalizedToWorld({ nx: 1, ny: 1 }, 'home')).toEqual({ x: HALF_LENGTH, z: HALF_WIDTH });
  });

  it('reflects away team through the centre', () => {
    const home = normalizedToWorld({ nx: 0.2, ny: 0.1 }, 'home');
    const away = normalizedToWorld({ nx: 0.2, ny: 0.1 }, 'away');
    expect(away.x).toBeCloseTo(-home.x);
    expect(away.z).toBeCloseTo(-home.z);
  });

  it('home goalkeeper stands near own goal (-X)', () => {
    expect(normalizedToWorld({ nx: 0.05, ny: 0.5 }, 'home').x).toBeLessThan(-45);
    expect(normalizedToWorld({ nx: 0.05, ny: 0.5 }, 'away').x).toBeGreaterThan(45);
  });

  it('round-trips normalized -> world -> normalized', () => {
    const sides: Side[] = ['home', 'away'];
    for (const side of sides) {
      for (let i = 0; i < 50; i++) {
        const p = { nx: Math.random(), ny: Math.random() };
        const back = worldToNormalized(normalizedToWorld(p, side), side);
        expect(back.nx).toBeCloseTo(p.nx, 10);
        expect(back.ny).toBeCloseTo(p.ny, 10);
      }
    }
  });

  it('clamps to pitch plus margin', () => {
    expect(clampToPitch({ x: 100, z: -100 }, 3)).toEqual({
      x: HALF_LENGTH + 3,
      z: -HALF_WIDTH - 3,
    });
    expect(clampToPitch({ x: 1, z: 2 }, 3)).toEqual({ x: 1, z: 2 });
  });
});
