import type { Controller } from '../app/Controller';
import { tr } from '../i18n/tr';
import { TOOL_KEYS } from '../interaction/toolKeys';
import type { AppState, ToolId } from '../state/schema';
import { el, icon } from './dom';
import { setPressed } from './sidebar/common';

const UNDO_ICON = 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3';
const REDO_ICON = 'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3';
const GRID_ICON = 'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16';
const LABEL_ICON = 'M4 7h10l5 5-5 5H4zM8 12h.01';
const TOOL_ICONS: Record<ToolId, string> = {
  select: 'M6 3l12 7.5-5.2 1.5L10.5 18z',
  run: 'M5 19L19 5M19 5h-7M19 5v7',
  pass: 'M5 19l2.5-2.5M10 14l2.5-2.5M15 9l4-4M19 5h-6M19 5v6',
  dribble: 'M3 17c2-3 3.5 1 5.5-1.5S12 14 14 11.5l5-5M19 6.5h-5M19 6.5v5',
  zone: 'M4 6h16v12H4z',
  note: 'M5 5h14v10H10l-5 4z',
  eraser: 'M8 20h11M4.5 15.5l9-9 5.5 5.5-8.5 8.5H9z',
};
const FRAME_ICON = 'M4 6h16v12H4zM8 6v12M16 6v12M12 10v4M10 12h4';
const RESET_ICON = 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5';
const HELP_ICON = 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01';

function iconButton(label: string, shortcut: string, d: string): HTMLButtonElement {
  const title = shortcut ? `${label} (${shortcut})` : label;
  return el('button', { class: 'btn btn-icon', type: 'button', 'aria-label': title, title }, [
    icon(d),
  ]);
}

const LIBRARY_ICON = 'M4 6a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z';
/** Shirt: import a real match's line-ups. */
const MATCH_ICON = 'M9 4l-5 3 2 4 2-1v10h8V10l2 1 2-4-5-3a3 3 0 0 1-6 0z';
const CAMERA_ICON = 'M4 8h3l2-2h6l2 2h3v11H4zM12 16.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';

export interface ToolbarActions {
  onHelp: () => void;
  onAddFrame: () => void;
  onLibrary: () => void;
  onMatchImport: () => void;
  onScreenshot: () => void;
  /** First click: asks for confirmation. */
  onResetArmed: () => void;
  onReset: () => void;
}

/** Top toolbar: directive tools, undo/redo, snap, labels, scenario/library, help. */
export class Toolbar {
  readonly root: HTMLElement;
  /** Container the directive tools are placed into. */
  readonly toolsSlot: HTMLElement;
  private undoBtn = iconButton(tr.history.undo, 'Ctrl+Z', UNDO_ICON);
  private redoBtn = iconButton(tr.history.redo, 'Ctrl+Shift+Z', REDO_ICON);
  private snapBtn = iconButton(tr.toolbar.snap, 'G', GRID_ICON);
  private labelsBtn = iconButton(tr.toolbar.labels, 'L', LABEL_ICON);
  private toolBtns = new Map<ToolId, HTMLButtonElement>();

  constructor(
    private ctl: Controller,
    actions: ToolbarActions,
  ) {
    const frameBtn = iconButton(tr.timeline.addFrame, 'K', FRAME_ICON);
    frameBtn.addEventListener('click', actions.onAddFrame);
    const libraryBtn = iconButton(tr.library.open, 'Ctrl+S', LIBRARY_ICON);
    libraryBtn.addEventListener('click', actions.onLibrary);
    const matchBtn = iconButton(tr.matchImport.open, '', MATCH_ICON);
    matchBtn.addEventListener('click', actions.onMatchImport);
    const pngBtn = iconButton(tr.library.exportPng, '', CAMERA_ICON);
    pngBtn.addEventListener('click', actions.onScreenshot);
    const helpBtn = iconButton(tr.toolbar.help, '?', HELP_ICON);
    const onHelp = actions.onHelp;
    this.undoBtn.addEventListener('click', () => ctl.undo());
    this.redoBtn.addEventListener('click', () => ctl.redo());
    this.snapBtn.addEventListener('click', () => ctl.toggleSnap());
    this.labelsBtn.addEventListener('click', () => ctl.toggleLabels());
    helpBtn.addEventListener('click', onHelp);

    const resetBtn = this.resetButton(actions.onResetArmed, actions.onReset);

    this.toolsSlot = el('div', {
      class: 'toolbar-group',
      role: 'group',
      'aria-label': tr.tools.label,
    });
    for (const { id, key } of TOOL_KEYS) {
      const b = iconButton(tr.tools.names[id], key, TOOL_ICONS[id]);
      b.addEventListener('click', () => ctl.setTool(id));
      this.toolBtns.set(id, b);
      this.toolsSlot.append(b);
    }
    this.root = el(
      'div',
      { class: 'panel toolbar', role: 'toolbar', 'aria-label': tr.toolbar.label },
      [
        this.toolsSlot,
        el('div', { class: 'toolbar-group' }, [this.undoBtn, this.redoBtn, resetBtn]),
        el('div', { class: 'toolbar-group' }, [this.snapBtn, this.labelsBtn]),
        el('div', { class: 'toolbar-group' }, [frameBtn, libraryBtn, matchBtn, pngBtn]),
        el('div', { class: 'toolbar-group' }, [helpBtn]),
      ],
    );

    this.render(ctl.state);
    ctl.store.subscribe((s) => this.render(s));
    ctl.history.subscribe(() => this.render(ctl.state));
  }

  /** Reset needs a second click within a few seconds (it is undoable, but drastic). */
  private resetButton(onArmed: () => void, onReset: () => void): HTMLButtonElement {
    const b = iconButton(tr.toolbar.reset, '', RESET_ICON);
    b.classList.add('btn-danger');
    let armed = 0;
    const disarm = () => {
      window.clearTimeout(armed);
      armed = 0;
      b.classList.remove('armed');
      b.title = tr.toolbar.reset;
      b.setAttribute('aria-label', tr.toolbar.reset);
    };
    b.addEventListener('click', () => {
      if (armed) {
        disarm();
        onReset();
        return;
      }
      b.classList.add('armed');
      b.title = tr.toolbar.resetConfirm;
      b.setAttribute('aria-label', tr.toolbar.resetConfirm);
      armed = window.setTimeout(disarm, 3000);
      onArmed();
    });
    b.addEventListener('blur', disarm);
    return b;
  }

  private render(s: AppState): void {
    this.undoBtn.disabled = !this.ctl.history.canUndo;
    this.redoBtn.disabled = !this.ctl.history.canRedo;
    setPressed(this.snapBtn, s.settings.snap);
    setPressed(this.labelsBtn, s.settings.showLabels);
    for (const [id, b] of this.toolBtns) setPressed(b, id === s.tool);
  }
}
