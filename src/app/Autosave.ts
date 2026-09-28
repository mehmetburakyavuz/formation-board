import { persistedChanged, toDocument } from '../state/document';
import { saveAutosave } from '../state/persistence';
import type { AppState } from '../state/schema';
import type { Store } from '../state/store';

const DEBOUNCE_MS = 1000;

/** Writes the board to localStorage 1 s after the last change (and when the page hides). */
export class Autosave {
  private timer = 0;
  private dirty = false;
  private warned = false;

  constructor(
    private store: Store<AppState>,
    private onError: () => void,
  ) {
    store.subscribe((s, prev) => {
      if (!persistedChanged(s, prev)) return;
      this.dirty = true;
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.flush(), DEBOUNCE_MS);
    });
    const flushNow = () => this.flush();
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushNow();
    });
  }

  flush(): void {
    window.clearTimeout(this.timer);
    if (!this.dirty) return;
    this.dirty = false;
    const ok = saveAutosave(toDocument(this.store.state));
    if (!ok && !this.warned) {
      this.warned = true;
      this.onError();
    }
  }
}
