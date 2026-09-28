import type { EventBus } from '../core/events';
import type { AppEvents } from '../app/events';
import { CAMERA_PRESETS } from '../scene/cameraPresets';
import { tr } from '../i18n/tr';
import { el, icon } from './dom';

const ROTATE_ICON = 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5';
const FULLSCREEN_ICON = 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5';

/** Bottom-right camera panel: preset angles, auto-rotate, fullscreen. */
export class CameraControls {
  readonly root: HTMLElement;
  private rotateBtn: HTMLButtonElement;

  constructor(bus: EventBus<AppEvents>) {
    const presetBtns = CAMERA_PRESETS.map((id, i) => {
      const b = el(
        'button',
        {
          class: 'btn btn-preset',
          type: 'button',
          'aria-label': `${tr.camera.presets[id]} (${i + 1})`,
          title: `${tr.camera.presets[id]} — ${i + 1}`,
        },
        [
          el('span', { class: 'kbd' }, [String(i + 1)]),
          el('span', {}, [tr.camera.presetsShort[id]]),
        ],
      );
      b.addEventListener('click', () => bus.emit('camera:preset', id));
      return b;
    });

    this.rotateBtn = el(
      'button',
      {
        class: 'btn btn-icon',
        type: 'button',
        'aria-label': `${tr.camera.autoRotate} (R)`,
        'aria-pressed': 'false',
        title: `${tr.camera.autoRotate} — R`,
      },
      [icon(ROTATE_ICON)],
    );
    this.rotateBtn.addEventListener('click', () => bus.emit('camera:toggleAutoRotate', undefined));

    const fsBtn = el(
      'button',
      {
        class: 'btn btn-icon',
        type: 'button',
        'aria-label': tr.camera.fullscreen,
        title: tr.camera.fullscreen,
      },
      [icon(FULLSCREEN_ICON)],
    );
    fsBtn.addEventListener('click', () => bus.emit('app:toggleFullscreen', undefined));

    this.root = el(
      'div',
      { class: 'panel camera-panel', role: 'group', 'aria-label': tr.camera.groupLabel },
      [
        el('div', { class: 'preset-row' }, presetBtns),
        el('div', { class: 'icon-row' }, [this.rotateBtn, fsBtn]),
      ],
    );

    bus.on('camera:autoRotateChanged', (on) => {
      this.rotateBtn.setAttribute('aria-pressed', String(on));
      this.rotateBtn.classList.toggle('active', on);
    });
  }
}
