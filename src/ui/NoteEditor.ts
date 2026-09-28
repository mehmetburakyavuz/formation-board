import { tr } from '../i18n/tr';
import { el } from './dom';

const MAX_LENGTH = 60;

/** Small floating text field for creating/editing a note at a screen position. */
export class NoteEditor {
  readonly root: HTMLFormElement;
  private input: HTMLInputElement;
  private onSave: ((text: string) => void) | null = null;
  private closing = false;

  constructor() {
    this.input = el('input', {
      class: 'text-input',
      type: 'text',
      maxlength: String(MAX_LENGTH),
      placeholder: tr.notes.placeholder,
      'aria-label': tr.notes.label,
    });
    const ok = el('button', { class: 'btn btn-primary', type: 'submit' }, [tr.notes.save]);
    this.root = el('form', { class: 'panel note-editor', hidden: '' }, [this.input, ok]);
    this.root.addEventListener('submit', (e) => {
      e.preventDefault();
      this.close(true);
    });
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close(false);
      }
    });
    this.root.addEventListener('focusout', (e) => {
      if (!this.root.contains(e.relatedTarget as Node | null)) this.close(true);
    });
  }

  open(clientX: number, clientY: number, text: string, onSave: (text: string) => void): void {
    this.close(false);
    this.onSave = onSave;
    this.input.value = text;
    this.root.hidden = false;
    const parent = this.root.offsetParent?.getBoundingClientRect();
    const w = this.root.offsetWidth;
    const maxX = (parent?.width ?? window.innerWidth) - w - 8;
    const x = Math.max(8, Math.min(maxX, clientX - (parent?.left ?? 0) - w / 2));
    const y = Math.max(8, clientY - (parent?.top ?? 0) - 56);
    this.root.style.left = `${x}px`;
    this.root.style.top = `${y}px`;
    // Opened on pointer-up: the press already happened, so focusing now is not undone.
    this.input.focus();
    this.input.select();
  }

  private close(save: boolean): void {
    if (this.closing || this.root.hidden) return;
    this.closing = true;
    const cb = this.onSave;
    this.onSave = null;
    this.root.hidden = true;
    if (save && cb) cb(this.input.value);
    this.closing = false;
  }
}
