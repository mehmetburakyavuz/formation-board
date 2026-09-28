import { tr } from '../i18n/tr';
import { captureScreenshot } from '../scene/Screenshot';
import type { SceneManager } from '../scene/SceneManager';
import { loadDocumentCommand, persistedOf, toDocument } from '../state/document';
import type { History } from '../state/history';
import { loadLibrary, saveLibrary } from '../state/persistence';
import type { AppState, LibraryEntry, TacticDocument } from '../state/schema';
import type { Store } from '../state/store';
import { parseTacticJson } from '../state/validate';
import { downloadBlob, safeFileName, timestamp } from '../ui/download';

export type Notify = (message: string, kind?: 'info' | 'error') => void;

let counter = 0;
function newEntryId(): string {
  counter = (counter + 1) % 1e6;
  return `t-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/** Tactic library (localStorage), JSON import/export and PNG screenshots. */
export class LibraryActions {
  private entries: LibraryEntry[] = loadLibrary();
  private listeners = new Set<() => void>();

  constructor(
    readonly store: Store<AppState>,
    private history: History<AppState>,
    private sceneManager: SceneManager,
    private notify: Notify,
  ) {}

  get list(): readonly LibraryEntry[] {
    return this.entries;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private commit(next: LibraryEntry[]): boolean {
    if (!saveLibrary(next)) {
      this.notify(tr.library.storageFailed, 'error');
      return false;
    }
    this.entries = next;
    for (const l of this.listeners) l();
    return true;
  }

  /** Saves the board under `name` (replaces an entry with the same name). */
  save(name: string): void {
    const trimmed = name.trim() || tr.library.untitled;
    this.store.update((s) => (s.tacticName === trimmed ? s : { ...s, tacticName: trimmed }));
    const doc = toDocument(this.store.state);
    const existing = this.entries.find((e) => e.name === trimmed);
    const entry: LibraryEntry = {
      id: existing?.id ?? newEntryId(),
      name: trimmed,
      savedAt: doc.savedAt,
      doc,
    };
    const next = existing
      ? this.entries.map((e) => (e.id === existing.id ? entry : e))
      : [entry, ...this.entries];
    if (this.commit(next)) this.notify(tr.library.saved(trimmed));
  }

  /** Replaces the board with a document as one undoable step. */
  private loadDoc(doc: TacticDocument): void {
    const before = persistedOf(this.store.state);
    this.history.execute(loadDocumentCommand(before, doc.state));
    this.notify(tr.library.loaded(doc.state.tacticName));
  }

  load(id: string): void {
    const e = this.entries.find((x) => x.id === id);
    if (e) this.loadDoc({ ...e.doc, state: { ...e.doc.state, tacticName: e.name } });
  }

  duplicate(id: string): void {
    const e = this.entries.find((x) => x.id === id);
    if (!e) return;
    const name = `${e.name} (${tr.library.copySuffix})`;
    const copy: LibraryEntry = {
      id: newEntryId(),
      name,
      savedAt: new Date().toISOString(),
      doc: { ...e.doc, state: { ...e.doc.state, tacticName: name } },
    };
    const i = this.entries.indexOf(e);
    const next = [...this.entries];
    next.splice(i + 1, 0, copy);
    this.commit(next);
  }

  remove(id: string): void {
    const e = this.entries.find((x) => x.id === id);
    if (e && this.commit(this.entries.filter((x) => x.id !== id))) {
      this.notify(tr.library.removed(e.name));
    }
  }

  exportJson(): void {
    const doc = toDocument(this.store.state);
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${safeFileName(doc.state.tacticName, 'taktik')}.json`);
    this.notify(tr.library.exported);
  }

  async importJson(file: File): Promise<void> {
    let text: string;
    try {
      text = await file.text();
    } catch {
      this.notify(tr.importErrors.readFailed, 'error');
      return;
    }
    const r = parseTacticJson(text);
    if (!r.ok) {
      this.notify(r.error, 'error');
      return;
    }
    this.loadDoc(r.doc);
  }

  async exportPng(): Promise<void> {
    try {
      const blob = await captureScreenshot(this.sceneManager, 2);
      const name = safeFileName(this.store.state.tacticName, 'taktik');
      downloadBlob(blob, `${name}-${timestamp()}.png`);
      this.notify(tr.library.pngSaved);
    } catch {
      this.notify(tr.library.pngFailed, 'error');
    }
  }
}
