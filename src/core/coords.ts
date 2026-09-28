/** 1 unit = 1 metre. Pitch length along X, width along Z, Y up. */
export const PITCH_LENGTH = 105;
export const PITCH_WIDTH = 68;
export const HALF_LENGTH = PITCH_LENGTH / 2;
export const HALF_WIDTH = PITCH_WIDTH / 2;

export type Side = 'home' | 'away';

export interface NormalizedPoint {
  nx: number;
  ny: number;
}

export interface GroundPoint {
  x: number;
  z: number;
}

/**
 * Normalized formation coordinates to world ground coordinates.
 * Home attacks +X (left side when facing +X is -Z); away is a point reflection.
 */
export function normalizedToWorld(p: NormalizedPoint, side: Side): GroundPoint {
  if (side === 'home') {
    return { x: (p.nx - 0.5) * PITCH_LENGTH, z: (p.ny - 0.5) * PITCH_WIDTH };
  }
  return { x: (0.5 - p.nx) * PITCH_LENGTH, z: (0.5 - p.ny) * PITCH_WIDTH };
}

export function worldToNormalized(p: GroundPoint, side: Side): NormalizedPoint {
  if (side === 'home') {
    return { nx: p.x / PITCH_LENGTH + 0.5, ny: p.z / PITCH_WIDTH + 0.5 };
  }
  return { nx: 0.5 - p.x / PITCH_LENGTH, ny: 0.5 - p.z / PITCH_WIDTH };
}

/** Clamp a ground point to the pitch plus a margin (metres). */
export function clampToPitch(p: GroundPoint, margin: number): GroundPoint {
  const mx = HALF_LENGTH + margin;
  const mz = HALF_WIDTH + margin;
  return {
    x: Math.min(mx, Math.max(-mx, p.x)),
    z: Math.min(mz, Math.max(-mz, p.z)),
  };
}

/** Attack direction along X for a side (+1 home, -1 away). */
export function attackSign(side: Side): 1 | -1 {
  return side === 'home' ? 1 : -1;
}
