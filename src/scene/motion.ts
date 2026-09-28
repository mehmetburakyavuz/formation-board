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

/** Metres covered per full stride cycle (two steps). */
const STRIDE = 2.4;
/** Stride cycles per second at most (fast sprint cadence). */
const MAX_CADENCE = 1.9;
/** A per-frame jump longer than this is a teleport (undo, load), not a run. */
const TELEPORT = 2.5;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Procedural run cycle driven by how fast the figure actually moves on the ground,
 * whatever moves it (formation glide, scenario playback). No skeleton: the figure
 * reads `phase` and `amount` to swing its limbs.
 */
export class RunGait {
  /** Stride phase, radians. */
  phase = 0;
  /** 0 = standing still … 1 = full run. */
  amount = 0;
  /** Direction of travel (yaw, 0 = +X), meaningful while `amount` > 0. */
  moveYaw = 0;
  private speed = 0;
  private lastX = 0;
  private lastZ = 0;
  private hasLast = false;

  /** `still`: moved by hand (dragging) — never run. */
  step(x: number, z: number, dtMs: number, still: boolean): void {
    if (dtMs <= 0) return;
    const dx = x - this.lastX;
    const dz = z - this.lastZ;
    const dist = Math.hypot(dx, dz);
    const valid = this.hasLast && !still && dist < TELEPORT;
    this.lastX = x;
    this.lastZ = z;
    this.hasLast = true;

    const v = valid ? dist / (dtMs / 1000) : 0;
    if (valid && dist > 1e-4) this.moveYaw = Math.atan2(-dz, dx);
    this.speed += (v - this.speed) * (1 - Math.exp(-dtMs / 80));

    const target = smoothstep(0.4, 3, this.speed);
    const tau = target > this.amount ? 90 : 180;
    this.amount += (target - this.amount) * (1 - Math.exp(-dtMs / tau));
    if (this.amount < 1e-3 && target === 0) this.amount = 0;

    const cadence = Math.min(this.speed / STRIDE, MAX_CADENCE);
    this.phase = (this.phase + cadence * Math.PI * 2 * (dtMs / 1000)) % (Math.PI * 2);
  }
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
