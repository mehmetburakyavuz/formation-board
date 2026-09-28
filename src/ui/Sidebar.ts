import type { Controller } from '../app/Controller';
import { FORMATIONS, type Formation } from '../data/formations';
import { tr } from '../i18n/tr';
import type { Phase } from '../logic/phases';
import type { AppState, TeamId } from '../state/schema';
import { el } from './dom';

const TEAMS: TeamId[] = ['home', 'away'];
const PHASES: Phase[] = ['attack', 'defence'];

/** Left panel: team, formation, phase and custom formation saving. */
export class Sidebar {
  readonly root: HTMLElement;
  private teamBtns = new Map<TeamId, HTMLButtonElement>();
  private phaseBtns = new Map<Phase, HTMLButtonElement>();
  private formationList: HTMLElement;
  private formationBtns = new Map<string, HTMLButtonElement>();
  private renderedCustom: Formation[] | null = null;
  private nameInput: HTMLInputElement;

  constructor(private ctl: Controller) {
    const teamRow = el('div', { class: 'segmented', role: 'group', 'aria-label': tr.sidebar.team });
    for (const id of TEAMS) {
      const b = el('button', { class: 'seg-btn', type: 'button' }, [tr.teams[id]]);
      b.addEventListener('click', () => ctl.setActiveTeam(id));
      this.teamBtns.set(id, b);
      teamRow.append(b);
    }

    this.formationList = el('div', {
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
    const saveForm = el('form', { class: 'inline-form' }, [this.nameInput, saveBtn]);
    saveForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.nameInput.value.trim();
      if (!name) {
        this.nameInput.focus();
        return;
      }
      ctl.saveCustomFormation(ctl.state.activeTeam, name);
      this.nameInput.value = '';
    });

    this.root = el('aside', { class: 'panel sidebar', 'aria-label': tr.sidebar.label }, [
      section(tr.sidebar.team, teamRow),
      section(tr.sidebar.formation, this.formationList),
      section(tr.sidebar.phase, phaseRow, tr.sidebar.phaseHint),
      section(tr.sidebar.saveCustom, saveForm),
    ]);

    this.render(ctl.state);
    ctl.store.subscribe((s) => this.render(s));
  }

  private buildFormations(custom: Formation[]): void {
    this.formationList.replaceChildren();
    this.formationBtns.clear();
    const add = (f: Formation, removable: boolean) => {
      const b = el('button', { class: 'formation-btn', type: 'button' }, [f.name]);
      b.addEventListener('click', () => this.ctl.setFormation(this.ctl.state.activeTeam, f.id));
      this.formationBtns.set(f.id, b);
      if (!removable) {
        this.formationList.append(b);
        return;
      }
      const del = el(
        'button',
        { class: 'formation-del', type: 'button', 'aria-label': tr.sidebar.deleteCustom(f.name) },
        ['×'],
      );
      del.addEventListener('click', () => this.ctl.deleteCustomFormation(f.id));
      this.formationList.append(el('div', { class: 'formation-custom' }, [b, del]));
    };
    for (const f of FORMATIONS) add(f, false);
    if (custom.length > 0) {
      this.formationList.append(el('div', { class: 'group-label' }, [tr.sidebar.customGroup]));
      for (const f of custom) add(f, true);
    }
    this.renderedCustom = custom;
  }

  private render(s: AppState): void {
    if (this.renderedCustom !== s.customFormations) this.buildFormations(s.customFormations);
    const team = s.teams[s.activeTeam];
    for (const [id, b] of this.teamBtns) setPressed(b, id === s.activeTeam);
    for (const [ph, b] of this.phaseBtns) setPressed(b, ph === team.phase);
    for (const [id, b] of this.formationBtns) setPressed(b, id === team.formationId);
  }
}

function setPressed(b: HTMLButtonElement, on: boolean): void {
  b.setAttribute('aria-pressed', String(on));
  b.classList.toggle('active', on);
}

function section(title: string, body: HTMLElement, hint?: string): HTMLElement {
  const children: HTMLElement[] = [el('h2', { class: 'section-title' }, [title])];
  if (hint) children.push(el('p', { class: 'section-hint' }, [hint]));
  children.push(body);
  return el('section', { class: 'sidebar-section' }, children);
}
