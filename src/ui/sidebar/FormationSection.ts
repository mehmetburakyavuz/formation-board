import type { Controller } from '../../app/Controller';
import { FORMATIONS, type Formation } from '../../data/formations';
import { tr } from '../../i18n/tr';
import type { Phase } from '../../logic/phases';
import type { AppState } from '../../state/schema';
import { el } from '../dom';
import { miniPitch } from '../MiniPitch';
import { section, setPressed } from './common';

const PHASES: Phase[] = ['attack', 'defence'];

/** Formation cards (with mini-pitch previews), phase switch and custom formation saving. */
export class FormationSection {
  readonly elements: HTMLElement[];
  private grid: HTMLElement;
  private cards = new Map<string, HTMLButtonElement>();
  private phaseBtns = new Map<Phase, HTMLButtonElement>();
  private renderedCustom: Formation[] | null = null;
  private nameInput: HTMLInputElement;

  constructor(private ctl: Controller) {
    this.grid = el('div', {
      class: 'formation-grid',
      role: 'group',
      'aria-label': tr.sidebar.formation,
    });

    const phaseRow = el('div', {
      class: 'segmented',
      role: 'group',
      'aria-label': tr.sidebar.phase,
    });
    for (const ph of PHASES) {
      const b = el('button', { class: 'seg-btn', type: 'button' }, [tr.sidebar.phases[ph]]);
      b.addEventListener('click', () => ctl.setPhase(ctl.state.activeTeam, ph));
      this.phaseBtns.set(ph, b);
      phaseRow.append(b);
    }

    this.nameInput = el('input', {
      class: 'text-input',
      type: 'text',
      maxlength: '32',
      placeholder: tr.sidebar.customPlaceholder,
      'aria-label': tr.sidebar.customPlaceholder,
    });
    const saveBtn = el('button', { class: 'btn btn-primary', type: 'submit' }, [tr.sidebar.save]);
    const form = el('form', { class: 'inline-form' }, [this.nameInput, saveBtn]);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.nameInput.value.trim();
      if (!name) {
        this.nameInput.focus();
        return;
      }
      ctl.saveCustomFormation(ctl.state.activeTeam, name);
      this.nameInput.value = '';
    });

    this.elements = [
      section(tr.sidebar.formation, this.grid),
      section(tr.sidebar.phase, phaseRow, tr.sidebar.phaseHint),
      section(tr.sidebar.saveCustom, form),
    ];
  }

  private card(f: Formation): HTMLButtonElement {
    const b = el('button', { class: 'formation-card', type: 'button', title: f.name }, [
      miniPitch(f),
      el('span', { class: 'formation-name' }, [f.name]),
    ]);
    b.addEventListener('click', () => this.ctl.setFormation(this.ctl.state.activeTeam, f.id));
    this.cards.set(f.id, b);
    return b;
  }

  private build(custom: Formation[]): void {
    // Keep keyboard focus stable across rebuilds.
    const focusedId = [...this.cards].find(([, b]) => b === document.activeElement)?.[0];
    this.grid.replaceChildren();
    this.cards.clear();
    for (const f of FORMATIONS) this.grid.append(this.card(f));
    if (custom.length > 0) {
      this.grid.append(el('div', { class: 'group-label' }, [tr.sidebar.customGroup]));
      for (const f of custom) {
        const del = el(
          'button',
          { class: 'card-del', type: 'button', 'aria-label': tr.sidebar.deleteCustom(f.name) },
          ['×'],
        );
        del.addEventListener('click', () => this.ctl.deleteCustomFormation(f.id));
        this.grid.append(el('div', { class: 'formation-custom' }, [this.card(f), del]));
      }
    }
    if (focusedId) this.cards.get(focusedId)?.focus();
    this.renderedCustom = custom;
  }

  render(s: AppState): void {
    if (this.renderedCustom !== s.customFormations) this.build(s.customFormations);
    const team = s.teams[s.activeTeam];
    for (const [id, b] of this.cards) setPressed(b, id === team.formationId);
    for (const [ph, b] of this.phaseBtns) setPressed(b, ph === team.phase);
  }
}
