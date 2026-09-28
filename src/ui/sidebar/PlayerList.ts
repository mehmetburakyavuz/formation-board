import type { Controller } from '../../app/Controller';
import { tr } from '../../i18n/tr';
import { roleLine } from '../../logic/assignSlots';
import type { AppState, PlayerState } from '../../state/schema';
import { el, icon } from '../dom';
import { section } from './common';

const EDIT_ICON = 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4';
const LINE_ORDER = { GK: 0, DEF: 1, MID: 2, ATT: 3 } as const;

function sortPlayers(players: PlayerState[], team: AppState['teams'][keyof AppState['teams']]) {
  // Order by line, then across the pitch from the team's left to right.
  const sign = team.id === 'home' ? 1 : -1;
  return [...players].sort(
    (a, b) =>
      LINE_ORDER[roleLine(a.role)] - LINE_ORDER[roleLine(b.role)] ||
      sign * (a.layouts.attack.z - b.layouts.attack.z),
  );
}

/** Active team's players: click selects in the scene, double click (or ✎) edits. */
export class PlayerList {
  readonly elements: HTMLElement[];
  private list: HTMLUListElement;
  private editingId: string | null = null;
  private lastKey = '';

  constructor(private ctl: Controller) {
    this.list = el('ul', { class: 'player-list', 'aria-label': tr.sidebar.players });
    this.elements = [section(tr.sidebar.players, this.list, tr.sidebar.playersHint)];
  }

  private row(p: PlayerState, s: AppState): HTMLLIElement {
    const team = s.teams[p.team];
    const color = p.role === 'GK' ? team.gkColor : team.color;
    const numColor = p.role === 'GK' ? '#111111' : team.numberColor;
    const label = p.name || tr.roles[p.role];
    const selected = s.selection.includes(p.id);

    if (this.editingId === p.id) return this.editRow(p);

    const badge = el('span', { class: 'num-badge' }, [String(p.number)]);
    badge.style.background = color;
    badge.style.color = numColor;
    const selectBtn = el(
      'button',
      {
        class: 'player-row-main',
        type: 'button',
        'aria-pressed': String(selected),
      },
      [
        badge,
        el('span', { class: 'player-name' }, [label]),
        // Role shown separately only when a custom name hides it.
        ...(p.name ? [el('span', { class: 'player-role' }, [tr.roles[p.role]])] : []),
      ],
    );
    selectBtn.addEventListener('click', (e) => {
      const sel = this.ctl.state.selection;
      if (e.shiftKey) {
        this.ctl.select(sel.includes(p.id) ? sel.filter((x) => x !== p.id) : [...sel, p.id]);
      } else this.ctl.select([p.id]);
    });
    selectBtn.addEventListener('dblclick', () => this.startEdit(p.id));

    const editBtn = el(
      'button',
      {
        class: 'btn btn-icon btn-ghost',
        type: 'button',
        'aria-label': tr.sidebar.editPlayer(label),
      },
      [icon(EDIT_ICON)],
    );
    editBtn.addEventListener('click', () => this.startEdit(p.id));

    return el('li', { class: selected ? 'player-row selected' : 'player-row' }, [
      selectBtn,
      editBtn,
    ]);
  }

  private editRow(p: PlayerState): HTMLLIElement {
    const num = el('input', {
      class: 'text-input num-input',
      type: 'number',
      min: '1',
      max: '99',
      value: String(p.number),
      'aria-label': tr.sidebar.playerNumber,
    });
    const name = el('input', {
      class: 'text-input',
      type: 'text',
      maxlength: '20',
      value: p.name,
      placeholder: tr.roles[p.role],
      'aria-label': tr.sidebar.playerName,
    });
    const form = el('form', { class: 'player-edit' }, [num, name]);
    let done = false;
    const finish = (commit: boolean) => {
      if (done) return;
      done = true;
      this.editingId = null;
      if (commit) {
        const n = Math.round(Number(num.value));
        const number = Number.isFinite(n) && n >= 1 && n <= 99 ? n : p.number;
        this.ctl.updatePlayer(p.id, { number, name: name.value.trim() });
      }
      this.render(this.ctl.state, true);
      this.focusRow(p.id);
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      finish(true);
    });
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        finish(false);
      }
    });
    form.addEventListener('focusout', (e) => {
      if (!form.contains(e.relatedTarget as Node | null)) finish(true);
    });
    const li = el('li', { class: 'player-row editing', 'data-id': p.id }, [form]);
    queueMicrotask(() => name.focus());
    return li;
  }

  private startEdit(id: string): void {
    this.editingId = id;
    this.render(this.ctl.state, true);
  }

  private focusRow(id: string): void {
    const idx = this.rowIds.indexOf(id);
    const btn = this.list.children[idx]?.querySelector<HTMLButtonElement>('.player-row-main');
    btn?.focus();
  }

  private rowIds: string[] = [];

  render(s: AppState, force = false): void {
    const team = s.teams[s.activeTeam];
    const players = sortPlayers(
      s.players.filter((p) => p.team === s.activeTeam),
      team,
    );
    // Rebuild only when something shown in the list changed.
    const key = JSON.stringify([
      team.color,
      team.gkColor,
      team.numberColor,
      s.selection,
      players.map((p) => [p.id, p.number, p.name, p.role]),
    ]);
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    const focusedIdx = [...this.list.querySelectorAll('.player-row-main')].indexOf(
      document.activeElement as Element,
    );
    this.rowIds = players.map((p) => p.id);
    this.list.replaceChildren(...players.map((p) => this.row(p, s)));
    if (focusedIdx >= 0) {
      this.list.querySelectorAll<HTMLButtonElement>('.player-row-main')[focusedIdx]?.focus();
    }
  }
}
