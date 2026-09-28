import type * as THREE from 'three';
import { easing } from '../core/tween';

/** Eased move of an object's ground position (formation changes, undo…). */
export class Glide {
  private fromX = 0;
  private fromZ = 0;
  private toX = 0;
  private toZ = 0;
  private elapsed = 0;
  private delay = 0;
  private duration = 0;
  private active = false;

  constructor(private obj: THREE.Object3D) {}

  start(x: number, z: number, durationMs: number, delayMs: number): void {
    const p = this.obj.position;
    if (Math.abs(p.x - x) < 1e-6 && Math.abs(p.z - z) < 1e-6) {
      this.stop();
      p.set(x, 0, z);
      return;
    }
    this.fromX = p.x;
    this.fromZ = p.z;
    this.toX = x;
    this.toZ = z;
    this.elapsed = 0;
    this.delay = delayMs;
    this.duration = durationMs;
    this.active = true;
  }

  stop(): void {
    this.active = false;
  }

  step(dtMs: number): void {
    if (!this.active) return;
    this.elapsed += dtMs;
    const t = Math.min(1, Math.max(0, (this.elapsed - this.delay) / this.duration));
    const k = easing.easeInOutCubic(t);
    this.obj.position.set(
      this.fromX + (this.toX - this.fromX) * k,
      0,
      this.fromZ + (this.toZ - this.fromZ) * k,
    );
    if (t >= 1) this.active = false;
  }
}

/** Rotates towards a target angle along the shortest way, frame-rate independent. */
export function approachAngle(
  current: number,
  target: number,
  dtMs: number,
  tauMs: number,
): number {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + d * (1 - Math.exp(-dtMs / tauMs));
}

/** Short squash-and-settle after a piece is dropped. Returns [xzScale, yScale]. */
export class DropBounce {
  private t = -1;

  trigger(): void {
    this.t = 0;
  }

  step(dtMs: number): [number, number] {
    if (this.t < 0) return [1, 1];
    this.t += dtMs;
    const k = this.t / 280;
    if (k >= 1) {
      this.t = -1;
      return [1, 1];
    }
    const squash = Math.sin(Math.PI * k) * (1 - k) * 0.14;
    return [1 + squash * 0.5, 1 - squash];
  }
}
