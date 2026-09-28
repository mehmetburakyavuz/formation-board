import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Pt } from '../../logic/arrowPath';

/** Anchor height for player notes (name label height); CSS lifts them above the label. */
const PLAYER_NOTE_Y = 2.25;
const GROUND_NOTE_Y = 0.1;

/** Short text note on the ground or above a player (CSS2D label). */
export class NoteView {
  readonly object: CSS2DObject;
  private el: HTMLDivElement;

  constructor(readonly id: string) {
    this.el = document.createElement('div');
    this.el.className = 'note-label';
    this.el.dataset.drawingId = id;
    this.object = new CSS2DObject(this.el);
    this.object.center.set(0.5, 1);
  }

  update(text: string, at: Pt, onPlayer: boolean, highlighted: boolean): void {
    if (this.el.textContent !== text) this.el.textContent = text;
    this.el.classList.toggle('on-player', onPlayer);
    this.el.classList.toggle('selected', highlighted);
    this.object.position.set(at.x, onPlayer ? PLAYER_NOTE_Y : GROUND_NOTE_Y, at.z);
  }

  dispose(): void {
    this.el.remove();
    this.object.removeFromParent();
  }
}
