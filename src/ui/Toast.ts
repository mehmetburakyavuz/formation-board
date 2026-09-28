const VISIBLE_MS = 3800;

/** Short status messages (polite live region). */
export class Toast {
  readonly root: HTMLDivElement;
  private timer = 0;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'toast';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
  }

  show(message: string, kind: 'info' | 'error' = 'info'): void {
    window.clearTimeout(this.timer);
    this.root.textContent = message;
    this.root.classList.toggle('error', kind === 'error');
    this.root.classList.add('visible');
    this.timer = window.setTimeout(() => this.root.classList.remove('visible'), VISIBLE_MS);
  }
}
