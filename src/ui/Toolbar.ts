import type { Controller } from '../app/Controller';
import { tr } from '../i18n/tr';
import type { AppState } from '../state/schema';
import { el, icon } from './dom';
import { setPressed } from './sidebar/common';

const UNDO_ICON = 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3';
const REDO_ICON = 'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3';
const GRID_ICON = 'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16';
const LABEL_ICON = 'M4 7h10l5 5-5 5H4zM8 12h.01';
const HELP_ICON = 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01';

function iconButton(label: string, shortcut: string, d: string): HTMLButtonElement {
  const title = shortcut ? `${label} (${shortcut})` : label;
  return el('button', { class: 'btn btn-icon', type: 'button', 'aria-label': title, title }, [
    icon(d),
  ]);
}

/** Top toolbar: (tools come in M5) undo/redo, snap, labels, help. */
export class Toolbar {
  readonly root: HTMLElement;
  /** Container the directive tools are placed into. */
  readonly toolsSlot: HTMLElement;
  private undoBtn = iconButton(tr.history.undo, 'Ctrl+Z', UNDO_ICON);
  private redoBtn = iconButton(tr.history.redo, 'Ctrl+Shift+Z', REDO_ICON);
  private snapBtn = iconButton(tr.toolbar.snap, 'G', GRID_ICON);
  private labelsBtn = iconButton(tr.toolbar.labels, 'L', LABEL_ICON);

  constructor(
    private ctl: Controller,
    onHelp: () => void,
  ) {
    const helpBtn = iconButton(tr.toolbar.help, '?', HELP_ICON);
    this.undoBtn.addEventListener('click', () => ctl.undo());
    this.redoBtn.addEventListener('click', () => ctl.redo());
    this.snapBtn.addEventListener('click', () => ctl.toggleSnap());
    this.labelsBtn.addEventListener('click', () => ctl.toggleLabels());
    helpBtn.addEventListener('click', onHelp);

    this.toolsSlot = el('div', { class: 'toolbar-group', hidden: '' });
    this.root = el(
      'div',
      { class: 'panel toolbar', role: 'toolbar', 'aria-label': tr.toolbar.label },
      [
        this.toolsSlot,
        el('div', { class: 'toolbar-group' }, [this.undoBtn, this.redoBtn]),
        el('div', { class: 'toolbar-group' }, [this.snapBtn, this.labelsBtn]),
        el('div', { class: 'toolbar-group' }, [helpBtn]),
      ],
    );

    this.render(ctl.state);
    ctl.store.subscribe((s) => this.render(s));
    ctl.history.subscribe(() => this.render(ctl.state));
  }

  private render(s: AppState): void {
    this.undoBtn.disabled = !this.ctl.history.canUndo;
    this.redoBtn.disabled = !this.ctl.history.canRedo;
    setPressed(this.snapBtn, s.settings.snap);
    setPressed(this.labelsBtn, s.settings.showLabels);
  }
}
