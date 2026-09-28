import type { ScenarioActions } from '../../app/ScenarioActions';
import { tr } from '../../i18n/tr';
import type { AppState, Keyframe, PlaybackSpeed } from '../../state/schema';
import { el, icon } from '../dom';
import { setPressed } from '../sidebar/common';
import { FrameCard } from './FrameCard';

const PLAY_ICON = 'M8 5v14l11-7z';
const PAUSE_ICON = 'M7 5h3v14H7zM14 5h3v14h-3z';
const RESTART_ICON = 'M6 5v14M18 5L9 12l9 7z';
const ADD_ICON = 'M12 5v14M5 12h14';
const UPDATE_ICON = 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5';
const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2];
const DRAG_THRESHOLD_PX = 6;

interface Reorder {
  pointerId: number;
  from: number;
  startX: number;
  dragging: boolean;
  to: number;
}

/** Bottom scenario timeline (hidden while there are no frames). */
export class Timeline {
  readonly root: HTMLElement;
  private list: HTMLOListElement;
  private cards: FrameCard[] = [];
  private playBtn: HTMLButtonElement;
  private speedBtns = new Map<PlaybackSpeed, HTMLButtonElement>();
  private updateBtn: HTMLButtonElement;
  private renderedFrames: Keyframe[] | null = null;
  private renderedTeams: AppState['teams'] | null = null;
  private reorder: Reorder | null = null;
  /** Set after a drag so the trailing click does not also jump to the frame. */
  private suppressClick = false;

  constructor(
    private actions: ScenarioActions,
    private onVisibilityChange: (visible: boolean) => void,
  ) {
    const player = actions.player;
    const btn = (label: string, d: string) =>
      el('button', { class: 'btn btn-icon', type: 'button', 'aria-label': label, title: label }, [
        icon(d),
      ]);
    const restartBtn = btn(tr.timeline.restart, RESTART_ICON);
    restartBtn.addEventListener('click', () => player.restart());
    this.playBtn = btn(tr.timeline.play, PLAY_ICON);
    this.playBtn.classList.add('btn-play');
    this.playBtn.addEventListener('click', () => player.toggle());

    const speedRow = el('div', {
      class: 'segmented speed',
      role: 'group',
      'aria-label': tr.timeline.speed,
    });
    for (const sp of SPEEDS) {
      const b = el('button', { class: 'seg-btn', type: 'button' }, [
        `${sp.toLocaleString('tr-TR')}×`,
      ]);
      b.addEventListener('click', () => actions.setSpeed(sp));
      this.speedBtns.set(sp, b);
      speedRow.append(b);
    }

    const addBtn = btn(tr.timeline.addFrame, ADD_ICON);
    addBtn.addEventListener('click', () => actions.addFrame());
    this.updateBtn = btn(tr.timeline.updateFrame, UPDATE_ICON);
    this.updateBtn.addEventListener('click', () => actions.updateCurrentFrame());

    this.list = el('ol', {
      class: 'frame-list',
      'aria-label': tr.timeline.frames,
      title: tr.timeline.hint,
    });
    this.list.addEventListener('pointerdown', this.onDown);
    this.list.addEventListener('pointermove', this.onMove);
    this.list.addEventListener('pointerup', this.onUp);
    this.list.addEventListener('pointercancel', () => this.endReorder(false));
    this.list.addEventListener('keydown', this.onKey);
    this.list.addEventListener('click', this.onClick);

    this.root = el(
      'section',
      { class: 'panel timeline', 'aria-label': tr.timeline.label, hidden: '' },
      [
        el('div', { class: 'timeline-controls' }, [
          restartBtn,
          this.playBtn,
          speedRow,
          el('span', { class: 'timeline-sep' }),
          addBtn,
          this.updateBtn,
        ]),
        this.list,
      ],
    );

    this.render(actions.state);
    actions.store.subscribe((s) => this.render(s));
    player.subscribe(() => this.renderPlayback(actions.state));
  }

  private render(s: AppState): void {
    const frames = s.scenario.frames;
    const visible = frames.length > 0;
    if (this.root.hidden === visible) {
      this.root.hidden = !visible;
      this.onVisibilityChange(visible);
    }
    if (frames !== this.renderedFrames || s.teams !== this.renderedTeams) {
      const focusedId = this.cards.find((c) => c.main === document.activeElement)?.frame.id;
      this.cards = frames.map((f, i) => new FrameCard(f, i, s, this.actions));
      this.list.replaceChildren(...this.cards.map((c) => c.root));
      this.cards.find((c) => c.frame.id === focusedId)?.main.focus();
      this.renderedFrames = frames;
      this.renderedTeams = s.teams;
    }
    for (const [sp, b] of this.speedBtns) setPressed(b, sp === s.scenario.speed);
    this.updateBtn.disabled = !s.scenario.current;
    this.renderPlayback(s);
  }

  private renderPlayback(s: AppState): void {
    const player = this.actions.player;
    const playing = player.status === 'playing';
    const label = playing ? tr.timeline.pause : tr.timeline.play;
    this.playBtn.replaceChildren(icon(playing ? PAUSE_ICON : PLAY_ICON));
    this.playBtn.setAttribute('aria-label', `${label} (${tr.help.keys.space})`);
    this.playBtn.title = label;
    this.playBtn.disabled = s.scenario.frames.length < 2 && !playing;
    const prog = player.progress;
    for (const c of this.cards) {
      const p = prog && prog.frameId === c.frame.id ? prog.t : null;
      c.setState(c.frame.id === s.scenario.current, p);
    }
  }

  // --- Reordering: drag a card, or Alt + ←/→ on a focused card ------------------

  private cardIndexAt(target: EventTarget | null): number {
    if (!(target instanceof Element)) return -1;
    const li = target.closest('.frame-card');
    return this.cards.findIndex((c) => c.root === li);
  }

  private onDown = (e: PointerEvent): void => {
    if (e.button !== 0 || !(e.target instanceof Element)) return;
    if (e.target.closest('select, .frame-del')) return;
    const from = this.cardIndexAt(e.target);
    if (from < 0) return;
    this.reorder = { pointerId: e.pointerId, from, startX: e.clientX, dragging: false, to: from };
  };

  private onMove = (e: PointerEvent): void => {
    const r = this.reorder;
    if (!r || r.pointerId !== e.pointerId) return;
    const dx = e.clientX - r.startX;
    if (!r.dragging && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
    if (!r.dragging) {
      r.dragging = true;
      this.list.setPointerCapture(e.pointerId);
      this.cards[r.from].root.classList.add('dragging');
    }
    this.cards[r.from].root.style.transform = `translateX(${dx}px)`;
    // Target slot = number of other cards whose centre is left of the pointer.
    let to = 0;
    this.cards.forEach((c, i) => {
      if (i === r.from) return;
      const rect = c.root.getBoundingClientRect();
      if (e.clientX > rect.left + rect.width / 2) to++;
    });
    r.to = to;
    this.cards.forEach((c, i) =>
      c.root.classList.toggle('drop-before', i !== r.from && i === (to >= r.from ? to + 1 : to)),
    );
  };

  private onUp = (e: PointerEvent): void => {
    const r = this.reorder;
    if (!r || r.pointerId !== e.pointerId) return;
    if (!r.dragging) {
      this.reorder = null;
      return;
    }
    this.suppressClick = true;
    this.endReorder(true);
  };

  /** Click (mouse, touch, Enter/Space) on a thumbnail jumps to that frame. */
  private onClick = (e: MouseEvent): void => {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    if (!(e.target instanceof Element) || !e.target.closest('.frame-main')) return;
    const i = this.cardIndexAt(e.target);
    if (i >= 0) this.actions.player.goTo(this.cards[i].frame.id);
  };

  private endReorder(commit: boolean): void {
    const r = this.reorder;
    this.reorder = null;
    if (!r?.dragging) return;
    for (const c of this.cards) {
      c.root.classList.remove('dragging', 'drop-before');
      c.root.style.transform = '';
    }
    if (commit) this.actions.moveFrame(r.from, r.to);
  }

  private onKey = (e: KeyboardEvent): void => {
    const i = this.cardIndexAt(e.target);
    if (i < 0 || !(e.target instanceof Element) || !e.target.closest('.frame-main')) return;
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const to = i + (e.key === 'ArrowLeft' ? -1 : 1);
      const id = this.cards[i].frame.id;
      this.actions.moveFrame(i, to);
      this.cards.find((c) => c.frame.id === id)?.main.focus();
    }
  };
}
