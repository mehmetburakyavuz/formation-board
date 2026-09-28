import { easing } from '../core/tween';
import type { Keyframe, PieceId } from '../state/schema';
import { arrowCenterline, pointAt, polylineLength, type Pt } from './arrowPath';

/** The ball "belongs" to the nearest player within this distance (metres). */
export const BALL_OWNER_RADIUS = 1.5;

export interface Pose {
  players: Map<PieceId, Pt>;
  ball: Pt;
}

export type BallMotion = 'pass' | 'carried' | 'free';

export function ballOwner(f: Keyframe): PieceId | null {
  let best: PieceId | null = null;
  let bestD = BALL_OWNER_RADIUS;
  for (const [id, p] of Object.entries(f.players)) {
    const d = Math.hypot(p.x - f.ball.x, p.z - f.ball.z);
    if (d <= bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

function lerp(a: Pt, b: Pt, k: number): Pt {
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
}

/** How the ball travels from frame `a` to frame `b`. */
export function ballMotion(a: Keyframe, b: Keyframe): BallMotion {
  const owner = ballOwner(a);
  if (owner && passFrom(a, owner)) return 'pass';
  if (owner && owner === ballOwner(b)) return 'carried';
  return 'free';
}

function passFrom(f: Keyframe, owner: PieceId) {
  for (const d of f.drawings) {
    if (
      d.type === 'arrow' &&
      d.style === 'pass' &&
      d.from.kind === 'player' &&
      d.from.id === owner
    ) {
      return d;
    }
  }
  return null;
}

/**
 * Board pose at progress `t` ∈ [0, 1] of the transition a → b.
 * Players ease between positions. The ball follows the owner's pass arrow (towards the
 * receiver's *current* position), stays with a player who keeps it, or moves freely.
 */
export function interpolate(a: Keyframe, b: Keyframe, t: number): Pose {
  const k = easing.easeInOutCubic(Math.min(1, Math.max(0, t)));
  const players = new Map<PieceId, Pt>();
  for (const [id, pa] of Object.entries(a.players)) {
    const pb = b.players[id] ?? pa;
    players.set(id, lerp(pa, pb, k));
  }
  for (const [id, pb] of Object.entries(b.players)) if (!players.has(id)) players.set(id, pb);

  const owner = ballOwner(a);
  const pass = owner ? passFrom(a, owner) : null;
  let ball: Pt;
  if (pass) {
    const to = pass.to;
    const end: Pt = to.kind === 'player' ? (players.get(to.id) ?? a.ball) : { x: to.x, z: to.z };
    const path = arrowCenterline(a.ball, end, pass.bend);
    ball = pointAt(path, polylineLength(path) * k);
  } else if (owner && owner === ballOwner(b)) {
    const pa = a.players[owner];
    const pb = b.players[owner] ?? pa;
    const offA = { x: a.ball.x - pa.x, z: a.ball.z - pa.z };
    const offB = { x: b.ball.x - pb.x, z: b.ball.z - pb.z };
    const at = players.get(owner) ?? pa;
    const off = lerp(offA, offB, k);
    ball = { x: at.x + off.x, z: at.z + off.z };
  } else {
    ball = lerp(a.ball, b.ball, k);
  }
  return { players, ball };
}
