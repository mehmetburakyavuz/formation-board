import type { Role } from '../data/formations';
import type { Side } from '../core/coords';

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
  /** World ground position (metres). */
  x: number;
  z: number;
  instructions: string[];
}

export interface TeamState {
  id: TeamId;
  name: string;
  color: string;
  numberColor: string;
  gkColor: string;
  formationId: string;
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
}
