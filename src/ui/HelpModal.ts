import { tr } from '../i18n/tr';
import { el } from './dom';

type Row = [keys: string[], label: string];

const h = tr.help;
const GROUPS: [string, Row[]][] = [
  [
    h.groups.tools,
    [
      [['V', 'A', 'P', 'D', 'Z', 'N', 'E'], h.items.tools],
      [['Alt'], h.items.curve],
      [['Del'], h.items.deleteDrawing],
    ],
  ],
  [
    h.groups.scenario,
    [
      [['K'], h.items.addFrame],
      [[h.keys.space], h.items.playPause],
    ],
  ],
  [
    h.groups.camera,
    [
      [['1', '–', '5'], h.items.presets],
      [['R'], h.items.rotate],
      [['F'], h.items.fullscreen],
    ],
  ],
  [
    h.groups.edit,
    [
      [['Ctrl', 'Z'], h.items.undo],
      [['Ctrl', 'Shift', 'Z'], h.items.redo],
      [['Ctrl', 'Y'], h.items.redo],
      [['G'], h.items.snap],
      [['L'], h.items.labels],
      [['T'], h.items.team],
    ],
  ],
  [
    h.groups.selection,
    [
      [[h.keys.click], h.items.select],
      [[h.keys.shiftClick], h.items.toggleSelect],
      [[h.keys.shiftDrag], h.items.boxSelect],
      [['Ctrl', 'A'], h.items.selectAll],
      [['Esc'], h.items.clear],
    ],
  ],
  [
    h.groups.general,
    [
      [['?'], h.items.help],
      [['Ctrl', 'S'], h.items.library],
      [['Tab'], h.items.tab],
    ],
  ],
];

/** Keyboard shortcut reference, opened with `?`. Uses a native modal <dialog>. */
export class HelpModal {
  readonly root: HTMLDialogElement;

  constructor() {
    const closeBtn = el('button', { class: 'btn', type: 'button' }, [h.close]);
    closeBtn.addEventListener('click', () => this.close());

    const groups = GROUPS.map(([title, rows]) =>
      el('section', { class: 'help-group' }, [
        el('h3', {}, [title]),
        el(
          'dl',
          {},
          rows.flatMap(([keys, label]) => [
            el(
              'dt',
              {},
              keys.map((k) => (k === '–' ? el('span', {}, ['–']) : el('kbd', {}, [k]))),
            ),
            el('dd', {}, [label]),
          ]),
        ),
      ]),
    );

    this.root = el('dialog', { class: 'panel help-modal', 'aria-labelledby': 'help-title' }, [
      el('h2', { id: 'help-title' }, [h.title]),
      el('div', { class: 'help-grid' }, groups),
      el('div', { class: 'help-actions' }, [closeBtn]),
    ]);
    // Click on the backdrop closes.
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });
  }

  get isOpen(): boolean {
    return this.root.open;
  }

  open(): void {
    if (!this.root.open) this.root.showModal();
  }

  close(): void {
    if (this.root.open) this.root.close();
  }

  toggle(): void {
    if (this.root.open) this.close();
    else this.open();
  }
}
