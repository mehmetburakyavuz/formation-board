import type { Controller } from '../../app/Controller';
import { tr } from '../../i18n/tr';
import type { TeamPatch } from '../../state/commands';
import type { AppState, OpponentMode, TeamId } from '../../state/schema';
import { el } from '../dom';
import { section, setPressed } from './common';

const TEAMS: TeamId[] = ['home', 'away'];
const OPPONENT_MODES: OpponentMode[] = ['normal', 'dim', 'hidden'];
type ColorKey = 'color' | 'numberColor' | 'gkColor';
const COLOR_FIELDS: [ColorKey, string][] = [
  ['color', tr.sidebar.shirtColor],
  ['numberColor', tr.sidebar.numberColor],
  ['gkColor', tr.sidebar.gkColor],
];

/** Active team switch, team settings (name, colours) and opponent visibility. */
export class TeamSection {
  readonly elements: HTMLElement[];
  private teamBtns = new Map<TeamId, HTMLButtonElement>();
  private swatches = new Map<TeamId, HTMLSpanElement>();
  private teamLabels = new Map<TeamId, HTMLSpanElement>();
  private nameInput: HTMLInputElement;
  private colorInputs = new Map<ColorKey, HTMLInputElement>();
  private opponentBtns = new Map<OpponentMode, HTMLButtonElement>();
  /** Values captured when a colour edit starts, for a single undo step. */
  private editStart: TeamPatch | null = null;

  constructor(ctl: Controller) {
    const teamRow = el('div', {
      class: 'segmented',
      role: 'group',
      'aria-label': tr.sidebar.activeTeam,
    });
    for (const id of TEAMS) {
      const swatch = el('span', { class: 'swatch' });
      const label = el('span', { class: 'team-label' });
      const b = el('button', { class: 'seg-btn team-btn', type: 'button' }, [swatch, label]);
      b.addEventListener('click', () => ctl.setActiveTeam(id));
      this.teamBtns.set(id, b);
      this.swatches.set(id, swatch);
      this.teamLabels.set(id, label);
      teamRow.append(b);
    }

    this.nameInput = el('input', {
      class: 'text-input',
      type: 'text',
      maxlength: '24',
      'aria-label': tr.sidebar.teamName,
    });
    this.nameInput.addEventListener('change', () => {
      const team = ctl.state.activeTeam;
      const name = this.nameInput.value.trim() || tr.teams[team];
      ctl.commitTeam(team, { name: ctl.state.teams[team].name }, { name });
    });

    const colorRow = el('div', { class: 'color-row' });
    for (const [key, label] of COLOR_FIELDS) {
      const input = el('input', { type: 'color', class: 'color-input', 'aria-label': label });
      input.addEventListener('input', () => {
        const team = ctl.state.activeTeam;
        this.editStart ??= { [key]: ctl.state.teams[team][key] };
        ctl.previewTeam(team, { [key]: input.value });
      });
      input.addEventListener('change', () => {
        const team = ctl.state.activeTeam;
        const before = this.editStart ?? { [key]: ctl.state.teams[team][key] };
        this.editStart = null;
        ctl.commitTeam(team, before, { [key]: input.value });
      });
      this.colorInputs.set(key, input);
      colorRow.append(el('label', { class: 'color-field' }, [input, el('span', {}, [label])]));
    }

    const settings = el('details', { class: 'team-settings' }, [
      el('summary', {}, [tr.sidebar.teamSettings]),
      el('label', { class: 'field' }, [
        el('span', { class: 'field-label' }, [tr.sidebar.teamName]),
        this.nameInput,
      ]),
      colorRow,
    ]);

    const oppRow = el('div', {
      class: 'segmented',
      role: 'group',
      'aria-label': tr.sidebar.opponent,
    });
    for (const mode of OPPONENT_MODES) {
      const b = el('button', { class: 'seg-btn', type: 'button' }, [
        tr.sidebar.opponentModes[mode],
      ]);
      b.addEventListener('click', () => ctl.setOpponentMode(mode));
      this.opponentBtns.set(mode, b);
      oppRow.append(b);
    }

    const teamBody = el('div', { class: 'stack' }, [teamRow, settings]);
    this.elements = [
      section(tr.sidebar.activeTeam, teamBody),
      section(tr.sidebar.opponent, oppRow),
    ];
  }

  render(s: AppState): void {
    for (const id of TEAMS) {
      const t = s.teams[id];
      const b = this.teamBtns.get(id);
      if (b) setPressed(b, id === s.activeTeam);
      const sw = this.swatches.get(id);
      if (sw) sw.style.background = t.color;
      const label = this.teamLabels.get(id);
      if (label) label.textContent = t.name;
    }
    const team = s.teams[s.activeTeam];
    if (document.activeElement !== this.nameInput) this.nameInput.value = team.name;
    for (const [key, input] of this.colorInputs) {
      if (input.value !== team[key]) input.value = team[key];
    }
    for (const [mode, b] of this.opponentBtns) setPressed(b, mode === s.settings.opponentMode);
  }
}
