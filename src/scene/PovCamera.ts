import * as THREE from 'three';
import type { PieceId } from '../state/schema';
import type { CameraRig } from './CameraRig';

export const EYE_HEIGHT = 1.7;
/** The orbit target sits just ahead of the eye, so orbiting = looking around. */
const LOOK_AHEAD = 0.05;
const ENTER_MS = 900;

interface Saved {
  position: THREE.Vector3;
  target: THREE.Vector3;
  minDistance: number;
  maxDistance: number;
  maxPolarAngle: number;
  autoRotate: boolean;
}

/**
 * "Player's eyes" camera: puts the camera at eye height looking in the attack direction
 * and follows the player while he moves. `exit()` flies back to the previous view.
 */
export class PovCamera {
  private player: PieceId | null = null;
  private saved: Saved | null = null;
  private lastEye = new THREE.Vector3();

  constructor(
    private rig: CameraRig,
    private camera: THREE.PerspectiveCamera,
  ) {}

  get active(): PieceId | null {
    return this.player;
  }

  /** `ground`: player's ground position; `facing`: +1 looks along +X, -1 along -X. */
  enter(id: PieceId, ground: THREE.Vector3, facing: 1 | -1): void {
    const c = this.rig.controls;
    if (!this.saved) {
      this.saved = {
        position: this.camera.position.clone(),
        target: c.target.clone(),
        minDistance: c.minDistance,
        maxDistance: c.maxDistance,
        maxPolarAngle: c.maxPolarAngle,
        autoRotate: c.autoRotate,
      };
    }
    this.player = id;
    const eye = ground.clone().setY(EYE_HEIGHT);
    this.lastEye.copy(eye);
    c.minDistance = LOOK_AHEAD;
    c.maxDistance = LOOK_AHEAD;
    c.maxPolarAngle = Math.PI - 0.05;
    c.enableZoom = false;
    c.enablePan = false;
    c.rotateSpeed = 0.35;
    this.rig.setAutoRotate(false);
    // Camera goes to the eye, target slightly ahead and a touch lower (natural gaze).
    const target = eye.clone().add(new THREE.Vector3(facing * LOOK_AHEAD, -0.004, 0));
    this.rig.transitionTo({ position: eye, target }, ENTER_MS);
  }

  exit(): boolean {
    const s = this.saved;
    if (!s) return false;
    const c = this.rig.controls;
    this.player = null;
    this.saved = null;
    c.minDistance = s.minDistance;
    c.maxDistance = s.maxDistance;
    c.maxPolarAngle = s.maxPolarAngle;
    c.enableZoom = true;
    c.enablePan = true;
    c.rotateSpeed = 1;
    this.rig.transitionTo({ position: s.position, target: s.target });
    if (s.autoRotate) this.rig.setAutoRotate(true);
    return true;
  }

  /** Leave POV without flying back (e.g. a preset was chosen). */
  release(): void {
    if (!this.saved) return;
    const s = this.saved;
    const c = this.rig.controls;
    this.player = null;
    this.saved = null;
    c.minDistance = s.minDistance;
    c.maxDistance = s.maxDistance;
    c.maxPolarAngle = s.maxPolarAngle;
    c.enableZoom = true;
    c.enablePan = true;
    c.rotateSpeed = 1;
  }

  /** Keeps the camera on the player's (visual) position; call every frame. */
  follow(ground: THREE.Vector3 | null): void {
    if (!this.player || !ground || this.rig.transitioning) return;
    const eye = ground.clone().setY(EYE_HEIGHT);
    const delta = eye.clone().sub(this.lastEye);
    if (delta.lengthSq() < 1e-10) return;
    this.lastEye.copy(eye);
    this.camera.position.add(delta);
    this.rig.controls.target.add(delta);
  }
}
