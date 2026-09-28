import * as THREE from 'three';
import { tr } from '../i18n/tr';
import type { Store, UpdateMeta } from '../state/store';
import {
  BALL_ID,
  type Anchor,
  type AppState,
  type PieceId,
  type PlayerState,
} from '../state/schema';
import { Ball } from './Ball';
import { kitKey, PlayerAssets } from './PlayerAssets';
import type { KitColors } from './playerGeometry';
import { PlayerMesh, type PlayerAppearance } from './PlayerMesh';

const GK_SHORTS = '#1d1d1d';

/** Outfield: shirt + socks in the team colour, shorts in the number colour. */
function kitOf(team: AppState['teams']['home'], isGk: boolean): KitColors {
  return isGk
    ? { shirt: team.gkColor, shorts: GK_SHORTS, socks: team.gkColor }
    : { shirt: team.color, shorts: team.numberColor, socks: team.color };
}

/** Reflects players and ball from the store into the scene. */
export class PiecesView {
  readonly group = new THREE.Group();
  readonly ball = new Ball();
  private assets = new PlayerAssets();
  private players = new Map<PieceId, PlayerMesh>();
  private hovered: PieceId | null = null;
  private unsubscribe: () => void;

  constructor(
    scene: THREE.Scene,
    private store: Store<AppState>,
  ) {
    this.group.name = 'pieces';
    this.group.add(this.ball.root);
    scene.add(this.group);
    this.sync(store.state, null, {});
    this.unsubscribe = store.subscribe((s, prev, meta) => this.sync(s, prev, meta));
  }

  private appearance(p: PlayerState, s: AppState): PlayerAppearance {
    const team = s.teams[p.team];
    const isGk = p.role === 'GK';
    return {
      number: p.number,
      label: p.name || tr.roles[p.role],
      badges: p.instructions.map((i) => tr.instructions[i]),
      bodyColor: isGk ? team.gkColor : team.color,
      kit: kitOf(team, isGk),
      numberColor: isGk ? '#111111' : team.numberColor,
      ringColor: team.color,
      facing: p.team === 'home' ? 1 : -1,
    };
  }

  private sync(s: AppState, prev: AppState | null, meta: UpdateMeta): void {
    const teamsChanged = !prev || prev.teams !== s.teams;
    const seen = new Set<PieceId>();
    s.players.forEach((p, i) => {
      seen.add(p.id);
      let mesh = this.players.get(p.id);
      const before = prev?.players[i];
      const isNew = !mesh;
      if (!mesh) {
        mesh = new PlayerMesh(p.id, this.assets);
        mesh.setLabelVisible(s.settings.showLabels);
        this.players.set(p.id, mesh);
        this.group.add(mesh.root);
      }
      if (isNew || before !== p || teamsChanged) {
        const moved = !before || before.x !== p.x || before.z !== p.z;
        if (isNew) mesh.setPosition(p.x, p.z);
        else if (moved && meta.animateMs) {
          // Small random stagger so a re-shape looks like players running, not a block.
          mesh.glideTo(p.x, p.z, meta.animateMs, Math.random() * 120);
        } else if (moved) mesh.setPosition(p.x, p.z);
        mesh.setAppearance(this.appearance(p, s));
      }
    });
    if (teamsChanged) {
      const kits = new Set<string>();
      const rings = new Set<string>();
      for (const t of Object.values(s.teams)) {
        kits.add(kitKey(kitOf(t, false))).add(kitKey(kitOf(t, true)));
        rings.add(t.color);
      }
      this.assets.prune(kits, rings);
    }
    for (const [id, mesh] of this.players) {
      if (!seen.has(id)) {
        mesh.dispose();
        this.players.delete(id);
      }
    }

    if (!prev || prev.ball !== s.ball) this.ball.setPosition(s.ball.x, s.ball.z);
    if (!prev || prev.settings !== s.settings) {
      this.ball.setScale(s.settings.ballScale);
      for (const m of this.players.values()) m.setLabelVisible(s.settings.showLabels);
    }
    if (
      !prev ||
      prev.settings.opponentMode !== s.settings.opponentMode ||
      prev.activeTeam !== s.activeTeam ||
      prev.players !== s.players
    ) {
      for (const p of s.players) {
        const mode = p.team === s.activeTeam ? 'normal' : s.settings.opponentMode;
        this.players.get(p.id)?.setVisibility(mode);
      }
    }
    if (!prev || prev.selection !== s.selection) {
      const sel = new Set(s.selection);
      for (const [id, m] of this.players) m.setSelected(sel.has(id));
      this.ball.setSelected(sel.has(BALL_ID));
    }
  }

  /**
   * Shows an arbitrary pose (scenario playback) without touching the store.
   * `null` returns every piece to its store position.
   */
  setOverride(
    pose: {
      players: ReadonlyMap<PieceId, { x: number; z: number }>;
      ball: { x: number; z: number };
    } | null,
  ): void {
    if (pose) {
      for (const [id, m] of this.players) {
        const p = pose.players.get(id);
        if (p) m.setPosition(p.x, p.z);
      }
      this.ball.setPosition(pose.ball.x, pose.ball.z);
      return;
    }
    const s = this.store.state;
    for (const p of s.players) this.players.get(p.id)?.setPosition(p.x, p.z);
    this.ball.setPosition(s.ball.x, s.ball.z);
  }

  /** Objects the raycaster should test (only interactive pieces). */
  pickables(filter: (id: PieceId) => boolean): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const [id, m] of this.players) if (filter(id)) out.push(m.hit);
    if (filter(BALL_ID)) out.push(this.ball.hit);
    return out;
  }

  setHovered(id: PieceId | null): void {
    if (this.hovered === id) return;
    if (this.hovered) this.piece(this.hovered)?.setHovered(false);
    this.hovered = id;
    if (id) this.piece(id)?.setHovered(true);
  }

  setLifted(ids: readonly PieceId[], on: boolean): void {
    for (const id of ids) this.piece(id)?.setLifted(on);
  }

  private piece(id: PieceId): PlayerMesh | Ball | undefined {
    return id === BALL_ID ? this.ball : this.players.get(id);
  }

  /** World position of a piece's anchor (on the ground). */
  worldPosition(id: PieceId, target: THREE.Vector3): THREE.Vector3 | null {
    const p = this.piece(id);
    return p ? target.copy(p.root.position) : null;
  }

  /** Hides one player's figure (the camera is in his eyes), or none. */
  setPovPlayer(id: PieceId | null): void {
    for (const [pid, m] of this.players) m.setPovHidden(pid === id);
  }

  /**
   * Players face their attack direction, or the direction of their own run/dribble
   * (else pass) arrow when they have one.
   */
  private updateHeadings(s: AppState): void {
    const arrows = new Map<PieceId, Anchor>();
    for (const d of s.drawings) {
      if (d.type !== 'arrow' || d.from.kind !== 'player') continue;
      const has = arrows.get(d.from.id);
      if (!has || d.style !== 'pass') arrows.set(d.from.id, d.to);
    }
    for (const p of s.players) {
      const m = this.players.get(p.id);
      if (!m) continue;
      let yaw = p.team === 'home' ? 0 : Math.PI;
      const to = arrows.get(p.id);
      const target = to ? this.anchorPosition(to) : null;
      if (target) {
        const dx = target.x - m.root.position.x;
        const dz = target.z - m.root.position.z;
        if (dx * dx + dz * dz > 0.25) yaw = Math.atan2(-dz, dx);
      }
      m.setHeading(yaw);
    }
  }

  private anchorPosition(a: Anchor): { x: number; z: number } | null {
    if (a.kind === 'point') return a;
    return this.players.get(a.id)?.root.position ?? null;
  }

  update(dtMs: number, timeMs: number, cameraPos?: THREE.Vector3): void {
    this.updateHeadings(this.store.state);
    for (const m of this.players.values()) m.update(dtMs, timeMs);
    const camDist = cameraPos ? cameraPos.distanceTo(this.ball.root.position) : 0;
    this.ball.update(dtMs, timeMs, camDist);
  }

  dispose(): void {
    this.unsubscribe();
    for (const m of this.players.values()) m.dispose();
    this.players.clear();
    this.ball.dispose();
    this.assets.dispose();
    this.group.removeFromParent();
  }
}
