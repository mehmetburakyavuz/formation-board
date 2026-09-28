import type { Formation, Role } from '../data/formations';
import type { InstructionId } from '../data/instructions';
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
  instructions: InstructionId[];
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

// --- Drawings (coach directives) ---------------------------------------------

/** A drawing end point: fixed on the ground or attached to a player (follows him). */
export type Anchor = { kind: 'point'; x: number; z: number } | { kind: 'player'; id: PieceId };

export type ArrowStyle = 'run' | 'pass' | 'dribble';

export interface ArrowDrawing {
  id: string;
  type: 'arrow';
  style: ArrowStyle;
  from: Anchor;
  to: Anchor;
  /**
   * Quadratic Bézier bend: signed perpendicular offset (metres) of the control point
   * from the chord midpoint. 0 = straight. Relative, so it survives moving anchors.
   */
  bend: number;
}

export type ZoneShape = 'rect' | 'ellipse';

export interface ZoneDrawing {
  id: string;
  type: 'zone';
  shape: ZoneShape;
  /** Two opposite corners of the bounding box on the ground. */
  a: GroundPoint;
  b: GroundPoint;
  color: string;
}

export interface NoteDrawing {
  id: string;
  type: 'note';
  anchor: Anchor;
  text: string;
}

export type Drawing = ArrowDrawing | ZoneDrawing | NoteDrawing;

export type ToolId = 'select' | 'run' | 'pass' | 'dribble' | 'zone' | 'note' | 'eraser';

/** How the non-active (opponent) team is drawn. */
export type OpponentMode = 'normal' | 'dim' | 'hidden';

export interface Settings {
  snap: boolean;
  opponentMode: OpponentMode;
  showLabels: boolean;
  /** Visual ball enlargement for readability (1 = real size). */
  ballScale: number;
  arrowColors: Record<ArrowStyle, string>;
  zoneColor: string;
  zoneShape: ZoneShape;
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
  drawings: Drawing[];
  tool: ToolId;
  /** Drawing selected with the select tool (shows its bend handle). */
  selectedDrawing: string | null;
}
