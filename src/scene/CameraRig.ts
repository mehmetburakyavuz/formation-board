import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HALF_LENGTH, HALF_WIDTH } from '../core/coords';
import { easing, lerp, type TweenHandle, type TweenManager } from '../core/tween';
import type { CameraPresetId } from './cameraPresets';

interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

const TRANSITION_MS = 800;
const PAN_MARGIN = 10;
const MIN_DISTANCE = 8;
const MAX_DISTANCE = 160;

/** OrbitControls + preset angles with smooth spherical transitions. */
export class CameraRig {
  readonly controls: OrbitControls;
  private transition: TweenHandle | null = null;
  private onAutoRotateChange: ((on: boolean) => void) | null = null;

  constructor(
    private camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    private tweens: TweenManager,
  ) {
    const c = new OrbitControls(camera, domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.maxPolarAngle = THREE.MathUtils.degToRad(85);
    c.minDistance = MIN_DISTANCE;
    c.maxDistance = MAX_DISTANCE;
    c.enablePan = true;
    c.screenSpacePanning = false;
    c.autoRotateSpeed = 0.6;
    c.zoomToCursor = true;
    // Any manual interaction cancels an in-flight preset transition.
    c.addEventListener('start', () => this.cancelTransition());
    this.controls = c;

    const pose = this.presetPose('broadcast');
    camera.position.copy(pose.position);
    c.target.copy(pose.target);
    c.update();
  }

  /** Subscribe to auto-rotate state changes (for UI sync). */
  setAutoRotateListener(cb: (on: boolean) => void): void {
    this.onAutoRotateChange = cb;
  }

  get autoRotate(): boolean {
    return this.controls.autoRotate;
  }

  setAutoRotate(on: boolean): void {
    this.controls.autoRotate = on;
    this.onAutoRotateChange?.(on);
  }

  toggleAutoRotate(): void {
    this.setAutoRotate(!this.controls.autoRotate);
  }

  presetPose(id: CameraPresetId): CameraPose {
    const target = new THREE.Vector3(0, 0, 0);
    switch (id) {
      case 'tactical': {
        // Fit pitch + margin: screen-vertical maps to Z, horizontal to X.
        const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
        const t = Math.tan(halfFov);
        const needZ = (HALF_WIDTH + 9) / t;
        const needX = (HALF_LENGTH + 6) / (t * Math.max(0.1, this.camera.aspect));
        const d = Math.min(MAX_DISTANCE, Math.max(needZ, needX));
        return { position: new THREE.Vector3(0, d, 0.001), target };
      }
      case 'broadcast': {
        const d = 105;
        const a = THREE.MathUtils.degToRad(35);
        return { position: new THREE.Vector3(0, Math.sin(a) * d, Math.cos(a) * d), target };
      }
      case 'behindHome':
        return {
          position: new THREE.Vector3(-HALF_LENGTH - 22, 16, 0),
          target: new THREE.Vector3(-8, 0, 0),
        };
      case 'behindAway':
        return {
          position: new THREE.Vector3(HALF_LENGTH + 22, 16, 0),
          target: new THREE.Vector3(8, 0, 0),
        };
      case 'threeQuarter':
        return {
          position: new THREE.Vector3(-78, 42, 62),
          target: new THREE.Vector3(-4, 0, 0),
        };
    }
  }

  goToPreset(id: CameraPresetId): void {
    this.transitionTo(this.presetPose(id));
  }

  /** Smoothly move camera and target. Interpolates in spherical coords around the target. */
  transitionTo(pose: CameraPose, duration = TRANSITION_MS): void {
    this.cancelTransition();
    const startTarget = this.controls.target.clone();
    const startSph = new THREE.Spherical().setFromVector3(
      this.camera.position.clone().sub(startTarget),
    );
    const endSph = new THREE.Spherical().setFromVector3(pose.position.clone().sub(pose.target));
    // Shortest way around.
    let dTheta = endSph.theta - startSph.theta;
    while (dTheta > Math.PI) dTheta -= Math.PI * 2;
    while (dTheta < -Math.PI) dTheta += Math.PI * 2;

    const sph = new THREE.Spherical();
    const offset = new THREE.Vector3();
    this.transition = this.tweens.add({
      duration,
      ease: easing.easeInOutCubic,
      onUpdate: (k) => {
        this.controls.target.lerpVectors(startTarget, pose.target, k);
        sph.set(
          lerp(startSph.radius, endSph.radius, k),
          lerp(startSph.phi, endSph.phi, k),
          startSph.theta + dTheta * k,
        );
        offset.setFromSpherical(sph);
        this.camera.position.copy(this.controls.target).add(offset);
        this.camera.lookAt(this.controls.target);
      },
      onComplete: () => {
        this.transition = null;
      },
    });
  }

  private cancelTransition(): void {
    if (this.transition) {
      this.transition.cancel();
      this.transition = null;
    }
  }

  get transitioning(): boolean {
    return this.transition !== null;
  }

  /** Call once per frame after tweens were updated. */
  update(dtMs: number): void {
    if (this.transition) return;
    this.controls.update(dtMs / 1000);
    this.clampPan();
  }

  /** Keep the orbit target inside the pitch plus margin; shift camera with it. */
  private clampPan(): void {
    const t = this.controls.target;
    const mx = HALF_LENGTH + PAN_MARGIN;
    const mz = HALF_WIDTH + PAN_MARGIN;
    const cx = THREE.MathUtils.clamp(t.x, -mx, mx);
    const cz = THREE.MathUtils.clamp(t.z, -mz, mz);
    const cy = THREE.MathUtils.clamp(t.y, 0, 5);
    const dx = cx - t.x;
    const dy = cy - t.y;
    const dz = cz - t.z;
    if (dx !== 0 || dy !== 0 || dz !== 0) {
      t.set(cx, cy, cz);
      this.camera.position.x += dx;
      this.camera.position.y += dy;
      this.camera.position.z += dz;
    }
  }

  dispose(): void {
    this.cancelTransition();
    this.controls.dispose();
  }
}
