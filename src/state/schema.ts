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

// --- Scenario (step-by-step play) ---------------------------------------------

/** Snapshot of the board used as an animation keyframe. */
export interface Keyframe {
  id: string;
  /** Player positions by id. */
  players: Record<PieceId, GroundPoint>;
  ball: GroundPoint;
  drawings: Drawing[];
  /** Transition time into this frame (ms, at 1× speed). */
  duration: number;
}

export type PlaybackSpeed = 0.5 | 1 | 2;

export interface Scenario {
  frames: Keyframe[];
  /** Frame the board currently shows (null after free edits or before any). */
  current: string | null;
  speed: PlaybackSpeed;
}

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
  /** Name of the tactic on the board (used for saving/exporting). */
  tacticName: string;
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
  scenario: Scenario;
}

// --- Persistence -----------------------------------------------------------------

/** Bumped whenever the persisted shape changes incompatibly. */
export const SCHEMA_VERSION = 1;

/** Board content that is saved, exported and loaded (UI-only fields are excluded). */
export type PersistedState = Pick<
  AppState,
  'tacticName' | 'teams' | 'players' | 'ball' | 'activeTeam' | 'settings' | 'drawings' | 'scenario'
>;

export interface TacticDocument {
  version: number;
  /** ISO timestamp. */
  savedAt: string;
  state: PersistedState;
}

export interface LibraryEntry {
  id: string;
  name: string;
  savedAt: string;
  doc: TacticDocument;
}
