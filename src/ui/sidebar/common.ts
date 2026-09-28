import { el } from '../dom';

export function setPressed(b: HTMLButtonElement, on: boolean): void {
  b.setAttribute('aria-pressed', String(on));
  b.classList.toggle('active', on);
}

export function section(title: string, body: HTMLElement, hint?: string): HTMLElement {
  const children: HTMLElement[] = [el('h2', { class: 'section-title' }, [title])];
  if (hint) children.push(el('p', { class: 'section-hint' }, [hint]));
  children.push(body);
  return el('section', { class: 'sidebar-section' }, children);
}
