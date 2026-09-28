import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export type FrameCallback = (dtMs: number, timeMs: number) => void;

const MAX_PIXEL_RATIO = 2;

/** Owns renderer, scene, main camera, lights and the render loop. */
export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly labelRenderer = new CSS2DRenderer();
  readonly container: HTMLElement;

  private callbacks = new Set<FrameCallback>();
  private lastTime = 0;
  private rafId = 0;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement) {
    this.container = container;
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.classList.add('scene-canvas');
    container.appendChild(this.renderer.domElement);

    this.labelRenderer.domElement.classList.add('label-layer');
    container.appendChild(this.labelRenderer.domElement);

    this.setupLights();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  private setupLights(): void {
    const hemi = new THREE.HemisphereLight(0xdfeeff, 0x2c4a22, 1.1);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
    sun.position.set(-40, 90, 45);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const cam = sun.shadow.camera;
    cam.left = -66;
    cam.right = 66;
    cam.top = 46;
    cam.bottom = -46;
    cam.near = 10;
    cam.far = 220;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.target.position.set(0, 0, 0);
    this.scene.add(sun, sun.target);
  }

  onFrame(cb: FrameCallback): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  get aspect(): number {
    return this.camera.aspect;
  }

  resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(w, h, false);
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start(): void {
    const loop = (time: number) => {
      this.rafId = requestAnimationFrame(loop);
      // Clamp dt so tab switches don't cause huge jumps.
      const dt = this.lastTime ? Math.min(100, time - this.lastTime) : 16;
      this.lastTime = time;
      for (const cb of this.callbacks) cb(dt, time);
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }
}
