import type { Controller } from '../../app/Controller';
import { tr } from '../../i18n/tr';
import type { AppState, ArrowStyle, ZoneShape } from '../../state/schema';
import { el } from '../dom';
import { section, setPressed } from './common';

const STYLES: ArrowStyle[] = ['run', 'pass', 'dribble'];
const SHAPES: ZoneShape[] = ['rect', 'ellipse'];

function colorField(label: string, onChange: (v: string) => void): HTMLInputElement {
  const input = el('input', { type: 'color', class: 'color-input', 'aria-label': label });
  input.addEventListener('input', () => onChange(input.value));
  return input;
}

/** Drawing settings: arrow colours, zone colour/shape, clear all. */
export class DrawingSection {
  readonly elements: HTMLElement[];
  private arrowInputs = new Map<ArrowStyle, HTMLInputElement>();
  private zoneInput: HTMLInputElement;
  private shapeBtns = new Map<ZoneShape, HTMLButtonElement>();
  private clearBtn: HTMLButtonElement;

  constructor(ctl: Controller) {
    const arrowRow = el('div', { class: 'color-row' });
    for (const style of STYLES) {
      const label = tr.tools.names[style];
      const input = colorField(label, (v) => ctl.setArrowColor(style, v));
      this.arrowInputs.set(style, input);
      arrowRow.append(el('label', { class: 'color-field' }, [input, el('span', {}, [label])]));
    }

    this.zoneInput = colorField(tr.drawing.zoneColor, (v) => ctl.setZoneColor(v));
    const shapeRow = el('div', {
      class: 'segmented',
      role: 'group',
      'aria-label': tr.drawing.zone,
    });
    for (const shape of SHAPES) {
      const b = el('button', { class: 'seg-btn', type: 'button' }, [tr.drawing.zoneShapes[shape]]);
      b.addEventListener('click', () => ctl.setZoneShape(shape));
      this.shapeBtns.set(shape, b);
      shapeRow.append(b);
    }
    const zoneRow = el('div', { class: 'zone-row' }, [
      el('label', { class: 'color-field zone-color' }, [this.zoneInput]),
      shapeRow,
    ]);

    this.clearBtn = el('button', { class: 'btn btn-danger', type: 'button' }, [tr.drawing.clear]);
    this.clearBtn.addEventListener('click', () => ctl.clearDrawings());

    const body = el('div', { class: 'stack' }, [
      el('span', { class: 'field-label' }, [tr.drawing.arrowColors]),
      arrowRow,
      el('span', { class: 'field-label' }, [tr.drawing.zone]),
      zoneRow,
      this.clearBtn,
    ]);
    this.elements = [section(tr.drawing.section, body, tr.drawing.hint)];
  }

  render(s: AppState): void {
    for (const [style, input] of this.arrowInputs) {
      const v = s.settings.arrowColors[style];
      if (input.value !== v) input.value = v;
    }
    if (this.zoneInput.value !== s.settings.zoneColor) this.zoneInput.value = s.settings.zoneColor;
    for (const [shape, b] of this.shapeBtns) setPressed(b, shape === s.settings.zoneShape);
    this.clearBtn.disabled = s.drawings.length === 0;
  }
}
