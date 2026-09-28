import type { ScenarioActions } from '../../app/ScenarioActions';
import { tr } from '../../i18n/tr';
import type { AppState, Keyframe } from '../../state/schema';
import { el } from '../dom';
import { framePitch } from '../MiniPitch';

const DURATIONS_MS = [500, 800, 1000, 1200, 1500, 2000, 2500, 3000, 4000];

/** One frame in the timeline: thumbnail (click = go to), transition time, delete. */
export class FrameCard {
  readonly root: HTMLElement;
  readonly main: HTMLButtonElement;
  private progress: HTMLElement;

  constructor(
    readonly frame: Keyframe,
    readonly index: number,
    s: AppState,
    actions: ScenarioActions,
  ) {
    const n = index + 1;
    this.main = el(
      'button',
      { class: 'frame-main', type: 'button', 'aria-label': tr.timeline.goTo(n) },
      [framePitch(frame, s), el('span', { class: 'frame-index' }, [String(n)])],
    );

    const select = el('select', {
      class: 'frame-duration',
      'aria-label': tr.timeline.duration(n),
    });
    const options = DURATIONS_MS.includes(frame.duration)
      ? DURATIONS_MS
      : [...DURATIONS_MS, frame.duration].sort((a, b) => a - b);
    for (const ms of options) {
      const o = el('option', { value: String(ms) }, [tr.timeline.seconds(ms / 1000)]);
      if (ms === frame.duration) o.selected = true;
      select.append(o);
    }
    select.addEventListener('change', () =>
      actions.setFrameDuration(frame.id, Number(select.value)),
    );
    // The first frame has no incoming transition.
    select.disabled = index === 0;

    const del = el(
      'button',
      { class: 'frame-del', type: 'button', 'aria-label': tr.timeline.remove(n) },
      ['×'],
    );
    del.addEventListener('click', () => actions.removeFrame(frame.id));

    this.progress = el('div', { class: 'frame-progress' });
    this.root = el('li', { class: 'frame-card', 'data-id': frame.id }, [
      this.main,
      el('div', { class: 'frame-meta' }, [select, del]),
      this.progress,
    ]);
  }

  setState(current: boolean, progress: number | null): void {
    this.root.classList.toggle('current', current);
    this.main.setAttribute('aria-current', current ? 'step' : 'false');
    this.progress.style.transform = `scaleX(${progress ?? 0})`;
    this.progress.classList.toggle('visible', progress !== null);
  }
}
