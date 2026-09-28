import { EventBus } from '../core/events';
import { TweenManager } from '../core/tween';
import { ShortcutManager } from '../interaction/shortcuts';
import { CameraRig } from '../scene/CameraRig';
import { CAMERA_PRESETS } from '../scene/cameraPresets';
import { Pitch } from '../scene/Pitch';
import { SceneManager } from '../scene/SceneManager';
import { CameraControls } from '../ui/CameraControls';
import { el } from '../ui/dom';
import type { AppEvents } from './events';

/** Wires scene, interaction and UI modules together. */
export class App {
  readonly bus = new EventBus<AppEvents>();
  readonly tweens = new TweenManager();
  readonly sceneManager: SceneManager;
  readonly cameraRig: CameraRig;
  readonly pitch: Pitch;
  readonly shortcuts = new ShortcutManager();

  constructor(root: HTMLElement) {
    const viewport = el('div', { class: 'viewport' });
    const overlay = el('div', { class: 'overlay' });
    root.append(viewport, overlay);

    this.sceneManager = new SceneManager(viewport);
    this.pitch = new Pitch(this.sceneManager.scene);
    this.cameraRig = new CameraRig(
      this.sceneManager.camera,
      this.sceneManager.renderer.domElement,
      this.tweens,
    );

    const cameraControls = new CameraControls(this.bus);
    overlay.append(cameraControls.root);

    this.wireCamera();

    this.sceneManager.onFrame((dt) => {
      this.tweens.update(dt);
      this.cameraRig.update(dt);
    });
    this.sceneManager.start();
  }

  private wireCamera(): void {
    const { bus, cameraRig } = this;
    cameraRig.setAutoRotateListener((on) => bus.emit('camera:autoRotateChanged', on));
    bus.on('camera:preset', (id) => cameraRig.goToPreset(id));
    bus.on('camera:toggleAutoRotate', () => cameraRig.toggleAutoRotate());
    bus.on('app:toggleFullscreen', () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen().catch(() => undefined);
    });

    CAMERA_PRESETS.forEach((id, i) => {
      this.shortcuts.register({ key: String(i + 1), handler: () => bus.emit('camera:preset', id) });
    });
    this.shortcuts.register({
      key: 'r',
      handler: () => bus.emit('camera:toggleAutoRotate', undefined),
    });
  }
}
