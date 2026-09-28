import type { Controller } from '../../app/Controller';
import { INSTRUCTIONS, type InstructionId } from '../../data/instructions';
import { tr } from '../../i18n/tr';
import type { AppState } from '../../state/schema';
import { el } from '../dom';
import { section } from './common';

/** Instruction chips for the selected player(s); shown as badges under their labels. */
export class InstructionSection {
  readonly elements: HTMLElement[];
  private hint: HTMLParagraphElement;
  private chips = new Map<InstructionId, HTMLButtonElement>();
  private grid: HTMLElement;

  constructor(ctl: Controller) {
    this.hint = el('p', { class: 'section-hint' });
    this.grid = el('div', {
      class: 'chip-grid',
      role: 'group',
      'aria-label': tr.instructionsSection.title,
    });
    for (const id of INSTRUCTIONS) {
      const b = el('button', { class: 'chip', type: 'button' }, [tr.instructions[id]]);
      b.addEventListener('click', () => ctl.toggleInstruction(id));
      this.chips.set(id, b);
      this.grid.append(b);
    }
    const body = el('div', { class: 'stack' }, [this.hint, this.grid]);
    this.elements = [section(tr.instructionsSection.title, body)];
  }

  render(s: AppState): void {
    const sel = new Set(s.selection);
    const players = s.players.filter((p) => sel.has(p.id));
    const n = players.length;
    this.grid.hidden = n === 0;
    if (n === 0) this.hint.textContent = tr.instructionsSection.none;
    else if (n === 1) this.hint.textContent = players[0].name || tr.roles[players[0].role];
    else this.hint.textContent = tr.instructionsSection.multi(n);

    for (const [id, b] of this.chips) {
      const count = players.filter((p) => p.instructions.includes(id)).length;
      const all = n > 0 && count === n;
      b.setAttribute('aria-pressed', all ? 'true' : count > 0 ? 'mixed' : 'false');
      b.classList.toggle('active', all);
      b.classList.toggle('mixed', count > 0 && !all);
    }
  }
}
