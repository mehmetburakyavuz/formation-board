import type { GroundPoint } from '../core/coords';
import { isRole } from '../data/formations';
import { isInstruction, type InstructionId } from '../data/instructions';
import { tr } from '../i18n/tr';
import {
  SCHEMA_VERSION,
  type Anchor,
  type BallState,
  type Drawing,
  type Keyframe,
  type PersistedState,
  type PlayerState,
  type Scenario,
  type Settings,
  type TacticDocument,
  type TeamId,
  type TeamState,
} from './schema';

/** Thrown with the path of the first invalid field. */
class Invalid extends Error {
  constructor(readonly path: string) {
    super(path);
  }
}

type Obj = Record<string, unknown>;

function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Invalid(path);
  return v as Obj;
}

function arr(v: unknown, path: string, max = 10_000): unknown[] {
  if (!Array.isArray(v) || v.length > max) throw new Invalid(path);
  return v;
}

function str(v: unknown, path: string, max = 200): string {
  if (typeof v !== 'string' || v.length > max) throw new Invalid(path);
  return v;
}

function num(v: unknown, path: string, min = -1e6, max = 1e6): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Invalid(path);
  return v;
}

function bool(v: unknown, path: string): boolean {
  if (typeof v !== 'boolean') throw new Invalid(path);
  return v;
}

function oneOf<T extends string | number>(v: unknown, options: readonly T[], path: string): T {
  if (!options.includes(v as T)) throw new Invalid(path);
  return v as T;
}

function color(v: unknown, path: string): string {
  const s = str(v, path, 7);
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) throw new Invalid(path);
  return s.toLowerCase();
}

/** Positions are allowed a generous margin around the pitch. */
function point(v: unknown, path: string): GroundPoint {
  const o = obj(v, path);
  return { x: num(o.x, `${path}.x`, -200, 200), z: num(o.z, `${path}.z`, -200, 200) };
}

const TEAMS: readonly TeamId[] = ['home', 'away'];

function team(v: unknown, id: TeamId, path: string): TeamState {
  const o = obj(v, path);
  return {
    id,
    name: str(o.name, `${path}.name`, 60),
    color: color(o.color, `${path}.color`),
    numberColor: color(o.numberColor, `${path}.numberColor`),
    gkColor: color(o.gkColor, `${path}.gkColor`),
    formationId: str(o.formationId, `${path}.formationId`, 100),
    phase: oneOf(o.phase, ['attack', 'defence'] as const, `${path}.phase`),
  };
}

function player(v: unknown, path: string): PlayerState {
  const o = obj(v, path);
  const role = str(o.role, `${path}.role`, 8);
  if (!isRole(role)) throw new Invalid(`${path}.role`);
  const layouts = obj(o.layouts, `${path}.layouts`);
  const instructions = arr(o.instructions, `${path}.instructions`, 50).map((x, i) => {
    const s = str(x, `${path}.instructions[${i}]`, 40);
    if (!isInstruction(s)) throw new Invalid(`${path}.instructions[${i}]`);
    return s as InstructionId;
  });
  return {
    id: str(o.id, `${path}.id`, 60),
    team: oneOf(o.team, TEAMS, `${path}.team`),
    number: Math.round(num(o.number, `${path}.number`, 1, 99)),
    name: str(o.name, `${path}.name`, 40),
    role,
    x: num(o.x, `${path}.x`, -200, 200),
    z: num(o.z, `${path}.z`, -200, 200),
    layouts: {
      attack: point(layouts.attack, `${path}.layouts.attack`),
      defence: point(layouts.defence, `${path}.layouts.defence`),
    },
    instructions,
  };
}

function anchor(v: unknown, path: string, playerIds: ReadonlySet<string>): Anchor {
  const o = obj(v, path);
  if (o.kind === 'point') return { kind: 'point', ...point(o, path) };
  if (o.kind === 'player') {
    const id = str(o.id, `${path}.id`, 60);
    if (!playerIds.has(id)) throw new Invalid(`${path}.id`);
    return { kind: 'player', id };
  }
  throw new Invalid(`${path}.kind`);
}

function drawing(v: unknown, path: string, playerIds: ReadonlySet<string>): Drawing {
  const o = obj(v, path);
  const id = str(o.id, `${path}.id`, 80);
  switch (o.type) {
    case 'arrow':
      return {
        id,
        type: 'arrow',
        style: oneOf(o.style, ['run', 'pass', 'dribble'] as const, `${path}.style`),
        from: anchor(o.from, `${path}.from`, playerIds),
        to: anchor(o.to, `${path}.to`, playerIds),
        bend: num(o.bend, `${path}.bend`, -500, 500),
      };
    case 'zone':
      return {
        id,
        type: 'zone',
        shape: oneOf(o.shape, ['rect', 'ellipse'] as const, `${path}.shape`),
        a: point(o.a, `${path}.a`),
        b: point(o.b, `${path}.b`),
        color: color(o.color, `${path}.color`),
      };
    case 'note':
      return {
        id,
        type: 'note',
        anchor: anchor(o.anchor, `${path}.anchor`, playerIds),
        text: str(o.text, `${path}.text`, 200),
      };
    default:
      throw new Invalid(`${path}.type`);
  }
}

function drawings(v: unknown, path: string, playerIds: ReadonlySet<string>): Drawing[] {
  return arr(v, path, 2000).map((d, i) => drawing(d, `${path}[${i}]`, playerIds));
}

function settings(v: unknown, path: string): Settings {
  const o = obj(v, path);
  const ac = obj(o.arrowColors, `${path}.arrowColors`);
  return {
    snap: bool(o.snap, `${path}.snap`),
    opponentMode: oneOf(
      o.opponentMode,
      ['normal', 'dim', 'hidden'] as const,
      `${path}.opponentMode`,
    ),
    showLabels: bool(o.showLabels, `${path}.showLabels`),
    ballScale: num(o.ballScale, `${path}.ballScale`, 0.5, 4),
    arrowColors: {
      run: color(ac.run, `${path}.arrowColors.run`),
      pass: color(ac.pass, `${path}.arrowColors.pass`),
      dribble: color(ac.dribble, `${path}.arrowColors.dribble`),
    },
    zoneColor: color(o.zoneColor, `${path}.zoneColor`),
    zoneShape: oneOf(o.zoneShape, ['rect', 'ellipse'] as const, `${path}.zoneShape`),
  };
}

function scenario(v: unknown, path: string, playerIds: ReadonlySet<string>): Scenario {
  const o = obj(v, path);
  const frames: Keyframe[] = arr(o.frames, `${path}.frames`, 500).map((f, i) => {
    const p = `${path}.frames[${i}]`;
    const fo = obj(f, p);
    const players: Record<string, GroundPoint> = {};
    for (const [id, pos] of Object.entries(obj(fo.players, `${p}.players`))) {
      if (!playerIds.has(id)) throw new Invalid(`${p}.players.${id}`);
      players[id] = point(pos, `${p}.players.${id}`);
    }
    return {
      id: str(fo.id, `${p}.id`, 80),
      players,
      ball: point(fo.ball, `${p}.ball`),
      drawings: drawings(fo.drawings, `${p}.drawings`, playerIds),
      duration: num(fo.duration, `${p}.duration`, 100, 10_000),
    };
  });
  const current = o.current === null ? null : str(o.current, `${path}.current`, 80);
  return {
    frames,
    current: frames.some((f) => f.id === current) ? current : null,
    speed: oneOf(o.speed, [0.5, 1, 2] as const, `${path}.speed`),
  };
}

function persisted(v: unknown): PersistedState {
  const o = obj(v, 'state');
  const t = obj(o.teams, 'teams');
  const players = arr(o.players, 'players', 60).map((p, i) => player(p, `players[${i}]`));
  const ids = new Set(players.map((p) => p.id));
  if (ids.size !== players.length || players.length === 0) throw new Invalid('players');
  const ball: BallState = point(o.ball, 'ball');
  return {
    tacticName: str(o.tacticName, 'tacticName', 100),
    teams: { home: team(t.home, 'home', 'teams.home'), away: team(t.away, 'away', 'teams.away') },
    players,
    ball,
    activeTeam: oneOf(o.activeTeam, TEAMS, 'activeTeam'),
    settings: settings(o.settings, 'settings'),
    drawings: drawings(o.drawings, 'drawings', ids),
    scenario: scenario(o.scenario, 'scenario', ids),
  };
}

export type ParseResult = { ok: true; doc: TacticDocument } | { ok: false; error: string };

/** Validates an unknown value (e.g. parsed JSON) as a tactic document. Pure. */
export function parseTacticDocument(v: unknown): ParseResult {
  if (typeof v !== 'object' || v === null || !('state' in v) || !('version' in v)) {
    return { ok: false, error: tr.importErrors.notTactic };
  }
  const o = v as Obj;
  if (typeof o.version !== 'number') return { ok: false, error: tr.importErrors.notTactic };
  if (o.version !== SCHEMA_VERSION) return { ok: false, error: tr.importErrors.version(o.version) };
  try {
    const state = persisted(o.state);
    const savedAt = typeof o.savedAt === 'string' ? o.savedAt : new Date(0).toISOString();
    return { ok: true, doc: { version: SCHEMA_VERSION, savedAt, state } };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: tr.importErrors.invalid(e.path) };
    throw e;
  }
}

/** Parses JSON text into a tactic document with a Turkish error message on failure. */
export function parseTacticJson(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: tr.importErrors.notJson };
  }
  return parseTacticDocument(data);
}
