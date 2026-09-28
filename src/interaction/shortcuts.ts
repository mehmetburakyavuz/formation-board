export interface Shortcut {
  /** `KeyboardEvent.key` (case-insensitive for letters) or `KeyboardEvent.code`. */
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (e: KeyboardEvent) => void;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/** Global keyboard shortcut registry. Ignores keys typed into form fields. */
export class ShortcutManager {
  private shortcuts: Shortcut[] = [];
  private listener = (e: KeyboardEvent) => this.handle(e);

  constructor(private target: Window = window) {
    target.addEventListener('keydown', this.listener);
  }

  register(s: Shortcut): () => void {
    this.shortcuts.push(s);
    return () => {
      this.shortcuts = this.shortcuts.filter((x) => x !== s);
    };
  }

  private handle(e: KeyboardEvent): void {
    if (isEditable(e.target)) return;
    // A modal dialog handles its own keys (Esc closes it natively).
    if (e.target instanceof Element && e.target.closest('dialog[open]')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    for (const s of this.shortcuts) {
      const keyMatch = s.key.toLowerCase() === e.key.toLowerCase() || s.key === e.code;
      if (!keyMatch) continue;
      if (!!s.ctrl !== ctrl) continue;
      if (s.shift !== undefined && s.shift !== e.shiftKey) continue;
      if (!!s.alt !== e.altKey) continue;
      e.preventDefault();
      s.handler(e);
      return;
    }
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.listener);
  }
}
