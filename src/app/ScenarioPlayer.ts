import { interpolate } from '../logic/scenario';
import type { PiecesView } from '../scene/PiecesView';
import type { History } from '../state/history';
import {
  applyFrame,
  boardCommand,
  boardDoc,
  captureFrame,
  type BoardDoc,
} from '../state/scenarioOps';
import type { AppState, Keyframe } from '../state/schema';
import type { Store } from '../state/store';

const SEEK_MS = 700;

export type PlayerStatus = 'idle' | 'seeking' | 'playing' | 'paused';

interface Transition {
  from: Keyframe;
  to: Keyframe;
  elapsed: number;
  /** Duration at 1× speed. */
  duration: number;
  /** Whether this transition respects the playback speed. */
  scaled: boolean;
}

/**
 * Animates the board between scenario frames. The store is only updated at frame
 * boundaries; in between, poses are shown through `PiecesView.setOverride` (drawings
 * of the frame being left stay visible and follow the moving players).
 * A seek or a whole playback session is recorded as one undo step.
 */
export class ScenarioPlayer {
  private t: Transition | null = null;
  private status_: PlayerStatus = 'idle';
  /** Index of the frame we are heading to while playing. */
  private targetIndex = -1;
  private sessionBefore: BoardDoc | null = null;
  private applying = false;
  private listeners = new Set<() => void>();

  constructor(
    private store: Store<AppState>,
    private history: History<AppState>,
    private pieces: PiecesView,
  ) {
    // An outside change to the board (edit, undo, frame list…) aborts playback.
    // Speed, selection, tool or view settings may change freely.
    store.subscribe((s, prev) => {
      if (this.applying || this.status_ === 'idle') return;
      const boardChanged =
        s.players !== prev.players ||
        s.ball !== prev.ball ||
        s.drawings !== prev.drawings ||
        s.scenario.frames !== prev.scenario.frames;
      if (boardChanged) this.abort();
    });
  }

  get status(): PlayerStatus {
    return this.status_;
  }

  get busy(): boolean {
    return this.status_ !== 'idle';
  }

  /** Target frame id and progress (0..1) of the running transition, for the UI. */
  get progress(): { frameId: string; t: number } | null {
    const t = this.t;
    if (!t) return null;
    return { frameId: t.to.id, t: Math.min(1, t.elapsed / this.durationOf(t)) };
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setStatus(s: PlayerStatus): void {
    this.status_ = s;
    for (const l of this.listeners) l();
  }

  private set(next: AppState): void {
    this.applying = true;
    this.store.set(next);
    this.applying = false;
  }

  private durationOf(t: Transition): number {
    return t.scaled ? t.duration / this.store.state.scenario.speed : t.duration;
  }

  private frames(): Keyframe[] {
    return this.store.state.scenario.frames;
  }

  private beginSession(): void {
    this.sessionBefore ??= boardDoc(this.store.state);
  }

  private endSession(): void {
    const before = this.sessionBefore;
    this.sessionBefore = null;
    if (!before) return;
    const after = boardDoc(this.store.state);
    const changed =
      before.players !== after.players ||
      before.ball !== after.ball ||
      before.drawings !== after.drawings ||
      before.current !== after.current;
    if (changed) this.history.record(boardCommand(before, after));
  }

  /** Animated jump from the current board to a frame. */
  goTo(frameId: string): void {
    const to = this.frames().find((f) => f.id === frameId);
    if (!to) return;
    this.finishNow();
    this.beginSession();
    this.t = {
      from: captureFrame(this.store.state, '__now__'),
      to,
      elapsed: 0,
      duration: SEEK_MS,
      scaled: false,
    };
    this.setStatus('seeking');
  }

  play(): void {
    if (this.status_ === 'paused') {
      this.setStatus('playing');
      return;
    }
    const frames = this.frames();
    if (frames.length < 2 || this.status_ === 'playing') return;
    this.finishNow();
    this.beginSession();
    let idx = frames.findIndex((f) => f.id === this.store.state.scenario.current);
    if (idx < 0 || idx >= frames.length - 1) {
      // Start over from the first frame.
      this.set(applyFrame(this.store.state, frames[0]));
      idx = 0;
    }
    this.startStep(idx);
    this.setStatus('playing');
  }

  private startStep(fromIndex: number): void {
    const frames = this.frames();
    const from = frames[fromIndex];
    const to = frames[fromIndex + 1];
    // Show the departing frame (positions + its drawings) before animating.
    this.set(applyFrame(this.store.state, from));
    this.targetIndex = fromIndex + 1;
    this.t = { from, to, elapsed: 0, duration: to.duration, scaled: true };
  }

  pause(): void {
    if (this.status_ === 'playing') this.setStatus('paused');
  }

  toggle(): void {
    if (this.status_ === 'playing') this.pause();
    else this.play();
  }

  /** Stops and shows the first frame. */
  restart(): void {
    const first = this.frames()[0];
    if (!first) return;
    this.finishNow();
    this.beginSession();
    this.set(applyFrame(this.store.state, first));
    this.endSession();
  }

  /** Completes the running transition immediately and ends the session. */
  finishNow(): void {
    if (this.t) {
      const to = this.t.to;
      this.t = null;
      this.pieces.setOverride(null);
      this.set(applyFrame(this.store.state, to));
    }
    if (this.status_ !== 'idle') this.setStatus('idle');
    this.endSession();
  }

  /** Outside change: drop the animation, keep the store as it is. */
  private abort(): void {
    this.t = null;
    this.pieces.setOverride(null);
    this.setStatus('idle');
    this.endSession();
  }

  update(dtMs: number): void {
    const t = this.t;
    if (!t || this.status_ === 'paused') return;
    t.elapsed += dtMs;
    const dur = this.durationOf(t);
    const k = Math.min(1, t.elapsed / dur);
    this.pieces.setOverride(interpolate(t.from, t.to, k));
    for (const l of this.listeners) l();
    if (k < 1) return;

    // Transition done: commit the target frame to the store.
    this.t = null;
    this.set(applyFrame(this.store.state, t.to));
    this.pieces.setOverride(null);
    if (this.status_ === 'playing' && this.targetIndex < this.frames().length - 1) {
      this.startStep(this.targetIndex);
      return;
    }
    this.setStatus('idle');
    this.endSession();
  }
}
