import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { GroundPoint } from '../core/coords';
import { tr } from '../i18n/tr';

const Y = 0.04;

export interface GuideSegment {
  from: GroundPoint;
  to: GroundPoint;
}

/** Faint dashed start→current lines while dragging, with a distance label on the primary. */
export class DragGuides {
  readonly group = new THREE.Group();
  private material = new THREE.LineDashedMaterial({
    color: 0xffffff,
    dashSize: 0.6,
    gapSize: 0.4,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  private lines: THREE.Line[] = [];
  private label: CSS2DObject;

  constructor(scene: THREE.Scene) {
    this.group.name = 'drag-guides';
    const el = document.createElement('div');
    el.className = 'distance-label';
    this.label = new CSS2DObject(el);
    this.label.visible = false;
    this.group.add(this.label);
    scene.add(this.group);
  }

  /** `segments[0]` is the grabbed piece and gets the distance label. */
  show(segments: GuideSegment[]): void {
    while (this.lines.length < segments.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geo, this.material);
      line.renderOrder = 3;
      line.frustumCulled = false;
      this.lines.push(line);
      this.group.add(line);
    }
    this.lines.forEach((line, i) => {
      const seg = segments[i];
      line.visible = !!seg;
      if (!seg) return;
      const pos = line.geometry.getAttribute('position') as THREE.BufferAttribute;
      pos.setXYZ(0, seg.from.x, Y, seg.from.z);
      pos.setXYZ(1, seg.to.x, Y, seg.to.z);
      pos.needsUpdate = true;
      line.computeLineDistances();
    });

    const primary = segments[0];
    if (!primary) {
      this.label.visible = false;
      return;
    }
    const d = Math.hypot(primary.to.x - primary.from.x, primary.to.z - primary.from.z);
    this.label.visible = d > 0.05;
    this.label.element.textContent = tr.metres(d);
    this.label.position.set(
      (primary.from.x + primary.to.x) / 2,
      Y,
      (primary.from.z + primary.to.z) / 2,
    );
  }

  hide(): void {
    for (const l of this.lines) l.visible = false;
    this.label.visible = false;
  }

  dispose(): void {
    for (const l of this.lines) l.geometry.dispose();
    this.material.dispose();
    this.label.element.remove();
    this.group.removeFromParent();
  }
}
