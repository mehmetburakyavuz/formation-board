import * as THREE from 'three';
import { HALF_LENGTH, PITCH_LENGTH, PITCH_WIDTH } from '../core/coords';
import { createGoals } from './Goal';
import { createPitchLines } from './pitchLines';
import { createGrassTexture } from './textures';

/** Grass extends this far beyond the touch/goal lines (metres). */
export const GRASS_MARGIN = 6;
const STRIPES = 12;
const HORIZON_COLOR = 0x0b0f14;

function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshBasicMaterial) {
          m.map?.dispose();
        }
        m.dispose();
      }
    }
  });
}

function createSkyDome(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(900, 32, 16);
  const colors: number[] = [];
  const top = new THREE.Color(0x1b2c40);
  const horizon = new THREE.Color(HORIZON_COLOR);
  const pos = geo.getAttribute('position');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 900; // -1..1
    c.copy(horizon).lerp(top, Math.pow(Math.max(0, t), 0.5));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'sky';
  sky.renderOrder = -1;
  return sky;
}

export class Pitch {
  readonly group = new THREE.Group();
  private disposeGoals: () => void;

  constructor(scene: THREE.Scene) {
    this.group.name = 'pitch';
    scene.fog = new THREE.Fog(HORIZON_COLOR, 140, 360);

    const sizeX = PITCH_LENGTH + GRASS_MARGIN * 2;
    const sizeZ = PITCH_WIDTH + GRASS_MARGIN * 2;
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(sizeX, sizeZ),
      new THREE.MeshStandardMaterial({
        map: createGrassTexture(sizeX, sizeZ, PITCH_LENGTH, STRIPES),
        roughness: 0.95,
        metalness: 0,
      }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    grass.name = 'grass';
    this.group.add(grass);

    // Dark "stadium floor" around the grass, fading into fog.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshBasicMaterial({ color: HORIZON_COLOR }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.03;
    floor.name = 'stadium-floor';
    this.group.add(floor);

    this.group.add(createPitchLines());

    const goals = createGoals(HALF_LENGTH);
    this.disposeGoals = goals.dispose;
    this.group.add(goals.group);

    this.group.add(createSkyDome());
    scene.add(this.group);
  }

  dispose(): void {
    const goals = this.group.getObjectByName('goals');
    if (goals) this.group.remove(goals);
    this.disposeGoals();
    disposeObject(this.group);
    this.group.removeFromParent();
  }
}
