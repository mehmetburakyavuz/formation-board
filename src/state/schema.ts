import type { Formation, Role } from '../data/formations';
import type { GroundPoint, Side } from '../core/coords';
import type { Phase } from '../logic/phases';

export type TeamId = Side;

/** Selectable/draggable piece id: a player id or the ball. */
export type PieceId = string;
export const BALL_ID: PieceId = 'ball';

export interface PlayerState {
  id: PieceId;
  team: TeamId;
  number: number;
  /** Empty name means the role abbreviation is shown instead. */
  name: string;
  role: Role;
  /** Current world ground position (metres) = `layouts[team.phase]`. */
  x: number;
  z: number;
  /** Positions per game phase (in / out of possession). */
  layouts: Record<Phase, GroundPoint>;
  instructions: string[];
}

export interface TeamState {
  id: TeamId;
  name: string;
  color: string;
  numberColor: string;
  gkColor: string;
  formationId: string;
  phase: Phase;
}

export interface BallState {
  x: number;
  z: number;
}

export interface Settings {
  snap: boolean;
  showLabels: boolean;
  /** Visual ball enlargement for readability (1 = real size). */
  ballScale: number;
}

export interface AppState {
  teams: Record<TeamId, TeamState>;
  players: PlayerState[];
  ball: BallState;
  activeTeam: TeamId;
  selection: PieceId[];
  settings: Settings;
  /** User-saved formations (also persisted separately in localStorage). */
  customFormations: Formation[];
}
