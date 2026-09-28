export type Easing = (t: number) => number;

export const easing = {
  linear: (t: number): number => t,
  easeInOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
} satisfies Record<string, Easing>;

export interface TweenOptions {
  /** Duration in milliseconds. */
  duration: number;
  delay?: number;
  ease?: Easing;
  /** Receives eased progress in [0, 1]. */
  onUpdate: (k: number) => void;
  onComplete?: () => void;
}

export interface TweenHandle {
  cancel(): void;
  readonly done: boolean;
}

interface ActiveTween {
  opts: TweenOptions;
  elapsed: number;
  cancelled: boolean;
  done: boolean;
}

/** Frame-driven tween runner. Call `update(dtMs)` once per frame. */
export class TweenManager {
  private tweens: ActiveTween[] = [];

  add(opts: TweenOptions): TweenHandle {
    const tw: ActiveTween = { opts, elapsed: 0, cancelled: false, done: false };
    this.tweens.push(tw);
    return {
      cancel: () => {
        tw.cancelled = true;
      },
      get done() {
        return tw.done || tw.cancelled;
      },
    };
  }

  get active(): boolean {
    return this.tweens.length > 0;
  }

  update(dtMs: number): void {
    if (this.tweens.length === 0) return;
    const current = this.tweens;
    this.tweens = [];
    for (const tw of current) {
      if (tw.cancelled) continue;
      tw.elapsed += dtMs;
      const { duration, delay = 0, ease = easing.easeInOutCubic } = tw.opts;
      const local = tw.elapsed - delay;
      if (local < 0) {
        this.tweens.push(tw);
        continue;
      }
      const t = duration <= 0 ? 1 : Math.min(1, local / duration);
      tw.opts.onUpdate(ease(t));
      if (t >= 1) {
        tw.done = true;
        tw.opts.onComplete?.();
      } else {
        this.tweens.push(tw);
      }
    }
  }
}

export function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}
