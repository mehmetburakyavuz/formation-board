import type { History } from '../state/history';
import {
  addFrameCommand,
  captureFrame,
  DEFAULT_FRAME_MS,
  MAX_FRAME_MS,
  MIN_FRAME_MS,
  moveFrameCommand,
  newFrameId,
  removeFrameCommand,
  replaceFrameCommand,
} from '../state/scenarioOps';
import type { AppState, PlaybackSpeed } from '../state/schema';
import type { Store } from '../state/store';
import type { ScenarioPlayer } from './ScenarioPlayer';

/** User intents for the scenario timeline (frames are undoable, playback is not). */
export class ScenarioActions {
  constructor(
    readonly store: Store<AppState>,
    private history: History<AppState>,
    readonly player: ScenarioPlayer,
  ) {}

  get state(): AppState {
    return this.store.state;
  }

  /** Saves the board as a new frame right after the current one (or at the end). */
  addFrame(): void {
    this.player.finishNow();
    const s = this.store.state;
    const frames = s.scenario.frames;
    const cur = frames.findIndex((f) => f.id === s.scenario.current);
    const index = cur >= 0 ? cur + 1 : frames.length;
    const duration = frames[cur]?.duration ?? DEFAULT_FRAME_MS;
    this.history.execute(addFrameCommand(captureFrame(s, newFrameId(), duration), index));
  }

  /** Overwrites the current frame with the board. */
  updateCurrentFrame(): void {
    this.player.finishNow();
    const s = this.store.state;
    const before = s.scenario.frames.find((f) => f.id === s.scenario.current);
    if (!before) return;
    this.history.execute(replaceFrameCommand(before, captureFrame(s, before.id, before.duration)));
  }

  removeFrame(id: string): void {
    this.player.finishNow();
    const cmd = removeFrameCommand(this.store.state, id);
    if (cmd) this.history.execute(cmd);
  }

  moveFrame(from: number, to: number): void {
    const n = this.store.state.scenario.frames.length;
    if (from === to || from < 0 || to < 0 || from >= n || to >= n) return;
    this.player.finishNow();
    this.history.execute(moveFrameCommand(from, to));
  }

  setFrameDuration(id: string, ms: number): void {
    const before = this.store.state.scenario.frames.find((f) => f.id === id);
    const duration = Math.min(MAX_FRAME_MS, Math.max(MIN_FRAME_MS, Math.round(ms)));
    if (!before || before.duration === duration) return;
    this.history.execute(replaceFrameCommand(before, { ...before, duration }));
  }

  setSpeed(speed: PlaybackSpeed): void {
    this.store.update((s) =>
      s.scenario.speed === speed ? s : { ...s, scenario: { ...s.scenario, speed } },
    );
  }
}
