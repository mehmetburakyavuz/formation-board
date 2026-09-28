import * as THREE from 'three';
import { tr } from '../i18n/tr';
import type { Store } from '../state/store';
import { BALL_ID, type AppState, type PieceId, type PlayerState } from '../state/schema';
import { Ball } from './Ball';
import { PlayerAssets } from './PlayerAssets';
import { PlayerMesh, type PlayerAppearance } from './PlayerMesh';

/** Reflects players and ball from the store into the scene. */
export class PiecesView {
  readonly group = new THREE.Group();
  readonly ball = new Ball();
  private assets = new PlayerAssets();
  private players = new Map<PieceId, PlayerMesh>();
  private hovered: PieceId | null = null;
  private unsubscribe: () => void;

  constructor(scene: THREE.Scene, store: Store<AppState>) {
    this.group.name = 'pieces';
    this.group.add(this.ball.root);
    scene.add(this.group);
    this.sync(store.state, null);
    this.unsubscribe = store.subscribe((s, prev) => this.sync(s, prev));
  }

  private appearance(p: PlayerState, s: AppState): PlayerAppearance {
    const team = s.teams[p.team];
    const isGk = p.role === 'GK';
    return {
      number: p.number,
      label: p.name || tr.roles[p.role],
      bodyColor: isGk ? team.gkColor : team.color,
      numberColor: isGk ? '#111111' : team.numberColor,
      ringColor: team.color,
      facing: p.team === 'home' ? 1 : -1,
    };
  }

  private sync(s: AppState, prev: AppState | null): void {
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
        mesh.setPosition(p.x, p.z);
        mesh.setAppearance(this.appearance(p, s));
      }
    });
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
    if (!prev || prev.selection !== s.selection) {
      const sel = new Set(s.selection);
      for (const [id, m] of this.players) m.setSelected(sel.has(id));
      this.ball.setSelected(sel.has(BALL_ID));
    }
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

  update(dtMs: number, timeMs: number): void {
    for (const m of this.players.values()) m.update(dtMs, timeMs);
    this.ball.update(dtMs, timeMs);
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
