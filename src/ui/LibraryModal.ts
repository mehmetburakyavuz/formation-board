import type { LibraryActions } from '../app/LibraryActions';
import { tr } from '../i18n/tr';
import { el } from './dom';

const dateFmt = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });

/** Tactic library dialog: save, load/duplicate/delete, JSON import/export, PNG. */
export class LibraryModal {
  readonly root: HTMLDialogElement;
  private list: HTMLUListElement;
  private nameInput: HTMLInputElement;
  private fileInput: HTMLInputElement;

  constructor(private lib: LibraryActions) {
    const L = tr.library;
    this.nameInput = el('input', {
      class: 'text-input',
      type: 'text',
      maxlength: '60',
      'aria-label': L.name,
      placeholder: L.name,
    });
    const saveForm = el('form', { class: 'inline-form' }, [
      this.nameInput,
      el('button', { class: 'btn btn-primary', type: 'submit' }, [L.saveNew]),
    ]);
    saveForm.addEventListener('submit', (e) => {
      e.preventDefault();
      lib.save(this.nameInput.value);
    });

    this.list = el('ul', { class: 'library-list', 'aria-label': L.listSection });

    this.fileInput = el('input', {
      type: 'file',
      accept: '.json,application/json',
      class: 'visually-hidden',
      tabindex: '-1',
      'aria-hidden': 'true',
    });
    this.fileInput.addEventListener('change', () => {
      const f = this.fileInput.files?.[0];
      this.fileInput.value = '';
      if (f) void lib.importJson(f).then(() => this.close());
    });
    const exportBtn = el('button', { class: 'btn', type: 'button' }, [L.exportJson]);
    exportBtn.addEventListener('click', () => lib.exportJson());
    const importBtn = el('button', { class: 'btn', type: 'button' }, [L.importJson]);
    importBtn.addEventListener('click', () => this.fileInput.click());
    const pngBtn = el('button', { class: 'btn', type: 'button' }, [L.exportPng]);
    pngBtn.addEventListener('click', () => {
      this.close();
      // Let the dialog disappear before capturing.
      requestAnimationFrame(() => void lib.exportPng());
    });

    const closeBtn = el('button', { class: 'btn', type: 'button' }, [L.close]);
    closeBtn.addEventListener('click', () => this.close());

    this.root = el(
      'dialog',
      { class: 'panel modal library-modal', 'aria-labelledby': 'library-title' },
      [
        el('h2', { id: 'library-title' }, [L.title]),
        el('section', { class: 'modal-section' }, [el('h3', {}, [L.saveSection]), saveForm]),
        el('section', { class: 'modal-section' }, [el('h3', {}, [L.listSection]), this.list]),
        el('section', { class: 'modal-section' }, [
          el('h3', {}, [L.fileSection]),
          el('div', { class: 'button-row' }, [exportBtn, importBtn, pngBtn, this.fileInput]),
        ]),
        el('div', { class: 'help-actions' }, [closeBtn]),
      ],
    );
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });

    lib.subscribe(() => this.renderList());
    this.renderList();
  }

  private renderList(): void {
    const L = tr.library;
    const entries = this.lib.list;
    if (entries.length === 0) {
      this.list.replaceChildren(el('li', { class: 'library-empty' }, [L.empty]));
      return;
    }
    this.list.replaceChildren(
      ...entries.map((e) => {
        const btn = (text: string, label: string, fn: () => void, cls = 'btn') => {
          const b = el('button', { class: cls, type: 'button', 'aria-label': label }, [text]);
          b.addEventListener('click', fn);
          return b;
        };
        const frames = e.doc.state.scenario.frames.length;
        const meta = [dateFmt.format(new Date(e.savedAt))];
        if (frames > 0) meta.push(L.frames(frames));
        return el('li', { class: 'library-item' }, [
          el('div', { class: 'library-info' }, [
            el('span', { class: 'library-name' }, [e.name]),
            el('span', { class: 'library-meta' }, [meta.join(' · ')]),
          ]),
          btn(
            L.load,
            L.loadLabel(e.name),
            () => {
              this.lib.load(e.id);
              this.close();
            },
            'btn btn-primary',
          ),
          btn(L.duplicate, L.duplicateLabel(e.name), () => this.lib.duplicate(e.id)),
          this.removeButton(e.id, e.name),
        ]);
      }),
    );
  }

  /** Delete needs a second click within a few seconds (library deletes are permanent). */
  private removeButton(id: string, name: string): HTMLButtonElement {
    const L = tr.library;
    const b = el(
      'button',
      { class: 'btn btn-danger', type: 'button', 'aria-label': L.removeLabel(name) },
      [L.remove],
    );
    let armed = 0;
    b.addEventListener('click', () => {
      if (armed) {
        window.clearTimeout(armed);
        this.lib.remove(id);
        return;
      }
      b.textContent = L.confirmRemove;
      b.classList.add('armed');
      armed = window.setTimeout(() => {
        armed = 0;
        b.textContent = L.remove;
        b.classList.remove('armed');
      }, 3000);
    });
    return b;
  }

  open(): void {
    if (this.root.open) return;
    this.nameInput.value = this.lib.store.state.tacticName;
    this.root.showModal();
    this.nameInput.focus();
    this.nameInput.select();
  }

  close(): void {
    if (this.root.open) this.root.close();
  }
}
