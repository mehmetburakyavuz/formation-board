import { Vector3 } from 'three';
import { EventBus } from '../core/events';
import { TweenManager } from '../core/tween';
import { DragController } from '../interaction/DragController';
import { Picker } from '../interaction/Picker';
import { SelectionController } from '../interaction/SelectionController';
import { ShortcutManager } from '../interaction/shortcuts';
import { TOOL_KEYS } from '../interaction/toolKeys';
import { ToolController } from '../interaction/ToolController';
import { CameraRig } from '../scene/CameraRig';
import { CAMERA_PRESETS } from '../scene/cameraPresets';
import { DragGuides } from '../scene/DragGuides';
import { DrawingLayer } from '../scene/drawings/DrawingLayer';
import { PiecesView } from '../scene/PiecesView';
import { Pitch } from '../scene/Pitch';
import { PovCamera } from '../scene/PovCamera';
import { SceneManager } from '../scene/SceneManager';
import { SnapGrid } from '../scene/SnapGrid';
import { History } from '../state/history';
import { createInitialState } from '../state/initialState';
import type { AppState } from '../state/schema';
import { Store } from '../state/store';
import { CameraControls } from '../ui/CameraControls';
import { HelpModal } from '../ui/HelpModal';
import { NoteEditor } from '../ui/NoteEditor';
import { Sidebar } from '../ui/Sidebar';
import { Toolbar } from '../ui/Toolbar';
import { Controller } from './Controller';
import { ScenarioActions } from './ScenarioActions';
import { ScenarioPlayer } from './ScenarioPlayer';
import { Timeline } from '../ui/timeline/Timeline';
import { tr } from '../i18n/tr';
import { withPersisted } from '../state/document';
import { loadAutosave } from '../state/persistence';
import { LibraryModal } from '../ui/LibraryModal';
import { MatchImportModal } from '../ui/MatchImportModal';
import { Toast } from '../ui/Toast';
import { Autosave } from './Autosave';
import { LibraryActions } from './LibraryActions';
import { el } from '../ui/dom';
import type { AppEvents } from './events';

/** Fresh board, or the last autosaved one if present and valid. */
function restoreState(): AppState {
  const initial = createInitialState();
  const saved = loadAutosave();
  return saved ? withPersisted(initial, saved.state) : initial;
}

/** Wires state, scene, interaction and UI modules together. */
export class App {
  readonly bus = new EventBus<AppEvents>();
  readonly tweens = new TweenManager();
  readonly store = new Store<AppState>(restoreState());
  readonly history = new History<AppState>(this.store);
  readonly controller = new Controller(this.store, this.history);
  readonly sceneManager: SceneManager;
  readonly cameraRig: CameraRig;
  readonly pitch: Pitch;
  readonly pieces: PiecesView;
  readonly snapGrid: SnapGrid;
  readonly drawings: DrawingLayer;
  readonly shortcuts = new ShortcutManager();
  readonly tool: ToolController;
  readonly selection: SelectionController;
  readonly sidebar: Sidebar;
  readonly help: HelpModal;
  readonly scenario: ScenarioActions;
  readonly library: LibraryActions;
  readonly libraryModal: LibraryModal;
  readonly matchModal: MatchImportModal;
  readonly pov: PovCamera;
  private guides: DragGuides;
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    const viewport = el('div', { class: 'viewport' });
    const overlay = el('div', { class: 'overlay' });
    root.append(viewport, overlay);

    const sm = new SceneManager(viewport);
    this.sceneManager = sm;
    this.pitch = new Pitch(sm.scene);
    this.cameraRig = new CameraRig(sm.camera, sm.renderer.domElement, this.tweens);
    this.pov = new PovCamera(this.cameraRig, sm.camera);
    this.pieces = new PiecesView(sm.scene, this.store);
    this.snapGrid = new SnapGrid(sm.scene);
    const guides = new DragGuides(sm.scene);
    this.guides = guides;
    const tmp = new Vector3();
    this.drawings = new DrawingLayer(sm.scene, this.store, (a) => {
      if (a.kind === 'point') return { x: a.x, z: a.z };
      const p = this.pieces.worldPosition(a.id, tmp);
      return p ? { x: p.x, z: p.z } : null;
    });

    const picker = new Picker(sm.camera, sm.renderer.domElement);
    this.selection = new SelectionController(this.store, picker, viewport);
    const drag = new DragController(
      this.store,
      picker,
      this.pieces,
      guides,
      this.cameraRig.controls,
    );
    const player = new ScenarioPlayer(this.store, this.history, this.pieces);
    this.scenario = new ScenarioActions(this.store, this.history, player);
    this.history.beforeChange = () => player.finishNow();
    // Touching the board during playback completes the running step first.
    viewport.addEventListener(
      'pointerdown',
      () => {
        if (player.busy) player.finishNow();
      },
      { capture: true },
    );

    const noteEditor = new NoteEditor();
    this.tool = new ToolController({
      el: viewport,
      store: this.store,
      controller: this.controller,
      picker,
      pieces: this.pieces,
      drawings: this.drawings,
      drag,
      selection: this.selection,
      requestPov: (id) => this.enterPov(id),
      requestNote: (at, anchor, existing) =>
        noteEditor.open(at.clientX, at.clientY, existing?.text ?? '', (text) =>
          this.controller.saveNote(anchor, text, existing?.id),
        ),
    });

    drag.onCommit = ({ before, after }) => this.controller.recordMove(before, after);

    this.help = new HelpModal();
    this.sidebar = new Sidebar(this.controller);
    const toast = new Toast();
    const notify = (msg: string, kind?: 'info' | 'error') => toast.show(msg, kind);
    new Autosave(this.store, () => notify(tr.library.storageFailed, 'error'));
    this.library = new LibraryActions(this.store, this.history, sm, notify);
    this.libraryModal = new LibraryModal(this.library);
    this.matchModal = new MatchImportModal(this.controller, notify);
    const toolbar = new Toolbar(this.controller, {
      onHelp: () => this.help.open(),
      onAddFrame: () => this.scenario.addFrame(),
      onLibrary: () => this.libraryModal.open(),
      onMatchImport: () => {
        this.exitPov();
        this.matchModal.open();
      },
      onScreenshot: () => void this.library.exportPng(),
      onResetArmed: () => notify(tr.toolbar.resetConfirm),
      onReset: () => {
        this.exitPov();
        this.controller.resetBoard();
        notify(tr.toolbar.resetDone);
      },
    });
    const timeline = new Timeline(this.scenario, (visible) =>
      overlay.classList.toggle('has-timeline', visible),
    );
    const cameraControls = new CameraControls(this.bus);
    overlay.append(
      this.sidebar.root,
      this.sidebar.openButton,
      toolbar.root,
      cameraControls.root,
      timeline.root,
      noteEditor.root,
      toast.root,
      this.help.root,
      this.libraryModal.root,
      this.matchModal.root,
    );

    this.wireCamera();
    this.wireEditing();

    this.store.subscribe((s, prev) => {
      if (s.settings.snap !== prev.settings.snap) this.snapGrid.setVisible(s.settings.snap);
    });
    this.snapGrid.setVisible(this.store.state.settings.snap);

    const povTmp = new Vector3();
    sm.onFrame((dt, time) => {
      this.tweens.update(dt);
      this.cameraRig.update(dt);
      player.update(dt);
      this.pieces.update(dt, time, sm.camera.position);
      const povId = this.pov.active;
      if (povId) this.pov.follow(this.pieces.worldPosition(povId, povTmp));
      this.drawings.update();
    });
    sm.start();
  }

  /** Camera at the player's eye height, looking in his attack direction. */
  private enterPov(id: string): void {
    const p = this.store.state.players.find((pl) => pl.id === id);
    const pos = this.pieces.worldPosition(id, new Vector3());
    if (!p || !pos) return;
    this.pieces.setPovPlayer(id);
    this.pov.enter(id, pos, p.team === 'home' ? 1 : -1);
  }

  private exitPov(): boolean {
    if (!this.pov.exit()) return false;
    this.pieces.setPovPlayer(null);
    return true;
  }

  private wireCamera(): void {
    const { bus, cameraRig } = this;
    cameraRig.setAutoRotateListener((on) => bus.emit('camera:autoRotateChanged', on));
    bus.on('camera:preset', (id) => {
      if (this.pov.active) {
        this.pov.release();
        this.pieces.setPovPlayer(null);
      }
      cameraRig.goToPreset(id);
    });
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
    const { shortcuts, controller, scenario } = this;
    const player = scenario.player;
    shortcuts.register({ key: 'z', ctrl: true, shift: true, handler: () => controller.redo() });
    shortcuts.register({ key: 'z', ctrl: true, shift: false, handler: () => controller.undo() });
    shortcuts.register({ key: 'y', ctrl: true, handler: () => controller.redo() });
    shortcuts.register({ key: 'k', handler: () => scenario.addFrame() });
    shortcuts.register({ key: 's', ctrl: true, handler: () => this.libraryModal.open() });
    shortcuts.register({
      key: ' ',
      // Space on a focused button/select keeps its native meaning.
      when: (e) => !(e.target instanceof Element && e.target.closest('button, select, summary, a')),
      handler: () => player.toggle(),
    });
    shortcuts.register({
      key: 'Escape',
      handler: () => {
        if (!this.exitPov()) this.tool.escape();
      },
    });
    shortcuts.register({ key: 'a', ctrl: true, handler: () => this.selection.selectActiveTeam() });
    shortcuts.register({ key: 'g', handler: () => controller.toggleSnap() });
    shortcuts.register({ key: 'l', handler: () => controller.toggleLabels() });
    shortcuts.register({ key: '?', handler: () => this.help.toggle() });
    shortcuts.register({
      key: 'f',
      handler: () => this.bus.emit('app:toggleFullscreen', undefined),
    });
    shortcuts.register({ key: 't', handler: () => controller.toggleActiveTeam() });
    for (const { id, key } of TOOL_KEYS) {
      shortcuts.register({ key, ctrl: false, handler: () => controller.setTool(id) });
    }
    const del = () => controller.removeSelectedDrawing();
    shortcuts.register({ key: 'Delete', handler: del });
    shortcuts.register({ key: 'Backspace', handler: del });
  }

  /** Tears everything down (GPU resources, listeners, DOM). */
  dispose(): void {
    this.shortcuts.dispose();
    this.tool.dispose();
    this.selection.dispose();
    this.drawings.dispose();
    this.pieces.dispose();
    this.snapGrid.dispose();
    this.guides.dispose();
    this.pitch.dispose();
    this.cameraRig.dispose();
    this.sceneManager.dispose();
    this.root.replaceChildren();
  }
}
