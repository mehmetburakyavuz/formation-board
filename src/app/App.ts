import { EventBus } from '../core/events';
import { TweenManager } from '../core/tween';
import { DragController } from '../interaction/DragController';
import { Picker } from '../interaction/Picker';
import { SelectionController } from '../interaction/SelectionController';
import { ShortcutManager } from '../interaction/shortcuts';
import { ToolController } from '../interaction/ToolController';
import { CameraRig } from '../scene/CameraRig';
import { CAMERA_PRESETS } from '../scene/cameraPresets';
import { DragGuides } from '../scene/DragGuides';
import { PiecesView } from '../scene/PiecesView';
import { Pitch } from '../scene/Pitch';
import { SceneManager } from '../scene/SceneManager';
import { SnapGrid } from '../scene/SnapGrid';
import { History } from '../state/history';
import { createInitialState } from '../state/initialState';
import type { AppState } from '../state/schema';
import { Store } from '../state/store';
import { CameraControls } from '../ui/CameraControls';
import { HelpModal } from '../ui/HelpModal';
import { Sidebar } from '../ui/Sidebar';
import { Toolbar } from '../ui/Toolbar';
import { Controller } from './Controller';
import { el } from '../ui/dom';
import type { AppEvents } from './events';

/** Wires state, scene, interaction and UI modules together. */
export class App {
  readonly bus = new EventBus<AppEvents>();
  readonly tweens = new TweenManager();
  readonly store = new Store<AppState>(createInitialState());
  readonly history = new History<AppState>(this.store);
  readonly controller = new Controller(this.store, this.history);
  readonly sceneManager: SceneManager;
  readonly cameraRig: CameraRig;
  readonly pitch: Pitch;
  readonly pieces: PiecesView;
  readonly snapGrid: SnapGrid;
  readonly shortcuts = new ShortcutManager();
  readonly tool: ToolController;
  readonly selection: SelectionController;
  readonly sidebar: Sidebar;
  readonly help: HelpModal;

  constructor(root: HTMLElement) {
    const viewport = el('div', { class: 'viewport' });
    const overlay = el('div', { class: 'overlay' });
    root.append(viewport, overlay);

    const sm = new SceneManager(viewport);
    this.sceneManager = sm;
    this.pitch = new Pitch(sm.scene);
    this.cameraRig = new CameraRig(sm.camera, sm.renderer.domElement, this.tweens);
    this.pieces = new PiecesView(sm.scene, this.store);
    this.snapGrid = new SnapGrid(sm.scene);
    const guides = new DragGuides(sm.scene);

    const picker = new Picker(sm.camera, sm.renderer.domElement);
    this.selection = new SelectionController(this.store, picker, viewport);
    const drag = new DragController(
      this.store,
      picker,
      this.pieces,
      guides,
      this.cameraRig.controls,
    );
    this.tool = new ToolController(viewport, this.store, picker, this.pieces, drag, this.selection);

    drag.onCommit = ({ before, after }) => this.controller.recordMove(before, after);

    this.help = new HelpModal();
    this.sidebar = new Sidebar(this.controller);
    const toolbar = new Toolbar(this.controller, () => this.help.open());
    const cameraControls = new CameraControls(this.bus);
    overlay.append(
      this.sidebar.root,
      this.sidebar.openButton,
      toolbar.root,
      cameraControls.root,
      this.help.root,
    );

    this.wireCamera();
    this.wireEditing();

    this.store.subscribe((s, prev) => {
      if (s.settings.snap !== prev.settings.snap) this.snapGrid.setVisible(s.settings.snap);
    });
    this.snapGrid.setVisible(this.store.state.settings.snap);

    sm.onFrame((dt, time) => {
      this.tweens.update(dt);
      this.cameraRig.update(dt);
      this.pieces.update(dt, time);
    });
    sm.start();
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

  private wireEditing(): void {
    const { shortcuts, controller } = this;
    shortcuts.register({ key: 'z', ctrl: true, shift: true, handler: () => controller.redo() });
    shortcuts.register({ key: 'z', ctrl: true, shift: false, handler: () => controller.undo() });
    shortcuts.register({ key: 'y', ctrl: true, handler: () => controller.redo() });
    shortcuts.register({ key: 'Escape', handler: () => this.tool.escape() });
    shortcuts.register({ key: 'a', ctrl: true, handler: () => this.selection.selectActiveTeam() });
    shortcuts.register({ key: 'g', handler: () => controller.toggleSnap() });
    shortcuts.register({ key: 'l', handler: () => controller.toggleLabels() });
    shortcuts.register({ key: '?', handler: () => this.help.toggle() });
    shortcuts.register({
      key: 'f',
      handler: () => this.bus.emit('app:toggleFullscreen', undefined),
    });
    shortcuts.register({ key: 't', handler: () => controller.toggleActiveTeam() });
  }
}
