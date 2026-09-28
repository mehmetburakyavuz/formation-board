import { describe, expect, it } from 'vitest';
import { ballMotion, ballOwner, interpolate } from '../src/logic/scenario';
import type { ArrowDrawing, Keyframe } from '../src/state/schema';

function frame(
  players: Record<string, [number, number]>,
  ball: [number, number],
  drawings: ArrowDrawing[] = [],
): Keyframe {
  return {
    id: Math.random().toString(36),
    players: Object.fromEntries(Object.entries(players).map(([id, [x, z]]) => [id, { x, z }])),
    ball: { x: ball[0], z: ball[1] },
    drawings,
    duration: 1200,
  };
}

const pass = (from: string, to: string): ArrowDrawing => ({
  id: 'p',
  type: 'arrow',
  style: 'pass',
  from: { kind: 'player', id: from },
  to: { kind: 'player', id: to },
  bend: 0,
});

describe('scenario interpolation', () => {
  it('finds the ball owner within the radius', () => {
    const f = frame({ a: [0, 0], b: [10, 0] }, [0.5, 0.5]);
    expect(ballOwner(f)).toBe('a');
    expect(ballOwner(frame({ a: [0, 0] }, [5, 5]))).toBeNull();
  });

  it('interpolates players from a to b with easing (exact at the ends)', () => {
    const A = frame({ a: [0, 0] }, [20, 20]);
    const B = frame({ a: [10, 4] }, [20, 20]);
    expect(interpolate(A, B, 0).players.get('a')).toEqual({ x: 0, z: 0 });
    expect(interpolate(A, B, 1).players.get('a')).toEqual({ x: 10, z: 4 });
    const mid = interpolate(A, B, 0.5).players.get('a');
    expect(mid?.x).toBeCloseTo(5);
  });

  it('moves the ball along the pass arrow to the running receiver', () => {
    const A = frame({ a: [0, 0], b: [20, 0] }, [0.5, 0], [pass('a', 'b')]);
    const B = frame({ a: [2, 0], b: [20, 10] }, [20, 10]);
    expect(ballMotion(A, B)).toBe('pass');
    // Ends exactly on the receiver's final position.
    const end = interpolate(A, B, 1).ball;
    expect(end.x).toBeCloseTo(20);
    expect(end.z).toBeCloseTo(10);
    // Starts where the ball was.
    expect(interpolate(A, B, 0).ball).toEqual({ x: 0.5, z: 0 });
  });

  it('keeps the ball with a player who carries it', () => {
    const A = frame({ a: [0, 0] }, [0.5, 0]);
    const B = frame({ a: [10, 0] }, [10.5, 0]);
    expect(ballMotion(A, B)).toBe('carried');
    for (const t of [0.2, 0.5, 0.8]) {
      const pose = interpolate(A, B, t);
      const p = pose.players.get('a');
      expect(p && pose.ball.x - p.x).toBeCloseTo(0.5);
    }
  });

  it('moves a loose ball linearly between frames', () => {
    const A = frame({ a: [0, 0] }, [30, 0]);
    const B = frame({ a: [0, 0] }, [40, 0]);
    expect(ballMotion(A, B)).toBe('free');
    expect(interpolate(A, B, 1).ball).toEqual({ x: 40, z: 0 });
  });

  it('ignores pass arrows from players who do not have the ball', () => {
    const A = frame({ a: [0, 0], b: [20, 0], c: [40, 0] }, [40.4, 0], [pass('a', 'b')]);
    const B = frame({ a: [0, 0], b: [20, 0], c: [45, 0] }, [45.4, 0]);
    expect(ballMotion(A, B)).toBe('carried');
  });
});
