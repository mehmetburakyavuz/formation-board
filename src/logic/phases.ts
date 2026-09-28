import type { NormalizedPoint } from '../core/coords';
import type { Role } from '../data/formations';

export type Phase = 'attack' | 'defence';

/** How far the block drops/compresses towards its own goal. */
export const DEFENCE_DEPTH_FACTOR = 0.8;
/** How much the block narrows towards the centre. */
export const DEFENCE_WIDTH_FACTOR = 0.9;

/**
 * Default defensive position derived from the attacking one: a compact block.
 * `nx` is scaled towards the own goal line, `ny` narrowed towards the centre.
 * Goalkeepers keep their position.
 */
export function deriveDefence(p: NormalizedPoint, role: Role): NormalizedPoint {
  if (role === 'GK') return { nx: p.nx, ny: p.ny };
  return {
    nx: p.nx * DEFENCE_DEPTH_FACTOR,
    ny: 0.5 + (p.ny - 0.5) * DEFENCE_WIDTH_FACTOR,
  };
}
