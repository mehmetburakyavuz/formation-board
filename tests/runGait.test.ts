import { describe, expect, it } from 'vitest';
import { RunGait } from '../src/scene/motion';

/** Moves the gait along X at `speed` m/s for `ms` milliseconds (16 ms frames). */
function run(g: RunGait, from: number, speed: number, ms: number, still = false): number {
  let x = from;
  for (let t = 0; t < ms; t += 16) {
    x += (speed * 16) / 1000;
    g.step(x, 0, 16, still);
  }
  return x;
}

describe('RunGait', () => {
  it('stands still when not moving', () => {
    const g = new RunGait();
    run(g, 0, 0, 1000);
    expect(g.amount).toBe(0);
  });

  it('runs when moving and faces the direction of travel', () => {
    const g = new RunGait();
    g.step(0, 0, 16, false);
    run(g, 0, 6, 600);
    expect(g.amount).toBeGreaterThan(0.9);
    expect(g.moveYaw).toBeCloseTo(0);
    run(g, 0, -6, 600);
    expect(Math.abs(g.moveYaw)).toBeCloseTo(Math.PI);
  });

  it('settles back to standing after stopping', () => {
    const g = new RunGait();
    g.step(0, 0, 16, false);
    const x = run(g, 0, 6, 600);
    for (let i = 0; i < 120; i++) g.step(x, 0, 16, false);
    expect(g.amount).toBe(0);
  });

  it('never runs while dragged by hand or on a teleport', () => {
    const g = new RunGait();
    g.step(0, 0, 16, false);
    run(g, 0, 6, 600, true);
    expect(g.amount).toBe(0);
    g.step(50, 0, 16, false);
    expect(g.amount).toBe(0);
  });
});
