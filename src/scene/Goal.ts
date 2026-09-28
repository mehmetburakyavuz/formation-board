import * as THREE from 'three';
import { createNetTexture } from './textures';

export const GOAL_WIDTH = 7.32;
export const GOAL_HEIGHT = 2.44;
const POST_R = 0.06;
const NET_DEPTH = 2;
const NET_TOP_DEPTH = 0.9;
const NET_CELL = 0.14;

/** Net surface in local goal space: x = depth behind goal line (>=0), z across, y up. */
function netGeometry(): THREE.BufferGeometry {
  const hw = GOAL_WIDTH / 2;
  const h = GOAL_HEIGHT;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], uvs: number[][]) => {
    const base = pos.length / 3;
    for (const v of [a, b, c, d]) pos.push(v[0], v[1], v[2]);
    for (const t of uvs) uv.push(t[0] / NET_CELL, t[1] / NET_CELL);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const slope = Math.hypot(NET_DEPTH - NET_TOP_DEPTH, h);

  // Roof
  quad(
    [0, h, -hw],
    [NET_TOP_DEPTH, h, -hw],
    [NET_TOP_DEPTH, h, hw],
    [0, h, hw],
    [
      [0, 0],
      [NET_TOP_DEPTH, 0],
      [NET_TOP_DEPTH, GOAL_WIDTH],
      [0, GOAL_WIDTH],
    ],
  );
  // Sloped back
  quad(
    [NET_TOP_DEPTH, h, -hw],
    [NET_DEPTH, 0, -hw],
    [NET_DEPTH, 0, hw],
    [NET_TOP_DEPTH, h, hw],
    [
      [0, 0],
      [slope, 0],
      [slope, GOAL_WIDTH],
      [0, GOAL_WIDTH],
    ],
  );
  // Sides (trapezoids as quads)
  for (const z of [-hw, hw]) {
    quad(
      [0, 0, z],
      [NET_DEPTH, 0, z],
      [NET_TOP_DEPTH, h, z],
      [0, h, z],
      [
        [0, 0],
        [NET_DEPTH, 0],
        [NET_TOP_DEPTH, h],
        [0, h],
      ],
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Shared resources so both goals reuse geometry/materials. */
class GoalResources {
  readonly postMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.1,
  });
  readonly postGeo = new THREE.CylinderGeometry(POST_R, POST_R, GOAL_HEIGHT + POST_R, 20);
  readonly barGeo = new THREE.CylinderGeometry(POST_R, POST_R, GOAL_WIDTH + POST_R * 4, 20);
  readonly netTex = createNetTexture();
  readonly netMat = new THREE.MeshStandardMaterial({
    map: this.netTex,
    transparent: true,
    opacity: 0.75,
    alphaTest: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
    roughness: 0.9,
  });
  readonly netGeo = netGeometry();

  dispose(): void {
    this.postMat.dispose();
    this.postGeo.dispose();
    this.barGeo.dispose();
    this.netTex.dispose();
    this.netMat.dispose();
    this.netGeo.dispose();
  }
}

export function createGoals(goalLineX: number): { group: THREE.Group; dispose: () => void } {
  const res = new GoalResources();
  const group = new THREE.Group();
  group.name = 'goals';

  for (const s of [-1, 1]) {
    const goal = new THREE.Group();
    goal.position.set(s * goalLineX, 0, 0);
    // Local +x points away from the pitch.
    if (s < 0) goal.rotation.y = Math.PI;

    for (const z of [-1, 1]) {
      const post = new THREE.Mesh(res.postGeo, res.postMat);
      post.position.set(0, (GOAL_HEIGHT + POST_R) / 2, z * (GOAL_WIDTH / 2 + POST_R));
      post.castShadow = true;
      goal.add(post);
    }
    const bar = new THREE.Mesh(res.barGeo, res.postMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(0, GOAL_HEIGHT + POST_R, 0);
    bar.castShadow = true;
    goal.add(bar);

    const net = new THREE.Mesh(res.netGeo, res.netMat);
    net.position.x = POST_R;
    net.renderOrder = 2;
    goal.add(net);

    group.add(goal);
  }
  return { group, dispose: () => res.dispose() };
}
