import type { Controller } from '../app/Controller';
import { tr } from '../i18n/tr';
import type { AppState } from '../state/schema';
import { el, icon } from './dom';
import { DrawingSection } from './sidebar/DrawingSection';
import { FormationSection } from './sidebar/FormationSection';
import { InstructionSection } from './sidebar/InstructionSection';
import { PlayerList } from './sidebar/PlayerList';
import { TeamSection } from './sidebar/TeamSection';

const CLOSE_ICON = 'M15 6l-6 6 6 6';
const OPEN_ICON = 'M4 6h16M4 12h16M4 18h16';
const MOBILE_QUERY = '(max-width: 767px)';
const COLLAPSED_KEY = 'formasyon.sidebarCollapsed';

function readCollapsed(): boolean | null {
  try {
    const v = localStorage.getItem(COLLAPSED_KEY);
    return v === null ? null : v === '1';
  } catch {
    return null;
  }
}

/**
 * Left panel (collapsible). Below 768 px it becomes a bottom drawer.
 * Hosts team, formation/phase and player list sections.
 */
export class Sidebar {
  readonly root: HTMLElement;
  readonly openButton: HTMLButtonElement;
  private panel: HTMLElement;
  private team: TeamSection;
  private formations: FormationSection;
  private players: PlayerList;
  private instructions: InstructionSection;
  private drawing: DrawingSection;
  private mobile = window.matchMedia(MOBILE_QUERY);

  constructor(ctl: Controller) {
    this.team = new TeamSection(ctl);
    this.formations = new FormationSection(ctl);
    this.players = new PlayerList(ctl);
    this.instructions = new InstructionSection(ctl);
    this.drawing = new DrawingSection(ctl);

    const closeBtn = el(
      'button',
      { class: 'btn btn-icon btn-ghost', type: 'button', 'aria-label': tr.sidebar.collapse },
      [icon(CLOSE_ICON)],
    );
    closeBtn.addEventListener('click', () => this.setCollapsed(true, true));

    const header = el('header', { class: 'sidebar-header' }, [
      el('span', { class: 'drawer-handle', 'aria-hidden': 'true' }),
      el('h1', { class: 'sidebar-title' }, [tr.sidebar.title]),
      closeBtn,
    ]);

    this.panel = el('div', { class: 'sidebar-body', id: 'sidebar-body' }, [
      ...this.team.elements,
      ...this.formations.elements,
      ...this.instructions.elements,
      ...this.players.elements,
      ...this.drawing.elements,
    ]);

    this.root = el('aside', { class: 'panel sidebar', 'aria-label': tr.sidebar.label }, [
      header,
      this.panel,
    ]);

    this.openButton = el(
      'button',
      {
        class: 'btn panel sidebar-open',
        type: 'button',
        'aria-label': tr.sidebar.expand,
        'aria-controls': 'sidebar-body',
      },
      [icon(OPEN_ICON), el('span', { class: 'sidebar-open-label' }, [tr.sidebar.title])],
    );
    this.openButton.addEventListener('click', () => this.setCollapsed(false, true));

    // Desktop: remember the user's choice. Mobile: drawer starts closed.
    this.setCollapsed(this.mobile.matches ? true : (readCollapsed() ?? false), false);
    this.mobile.addEventListener('change', (e) => this.setCollapsed(e.matches, false));

    this.render(ctl.state);
    ctl.store.subscribe((s) => this.render(s));
  }

  get collapsed(): boolean {
    return this.root.classList.contains('collapsed');
  }

  setCollapsed(collapsed: boolean, moveFocus: boolean): void {
    this.root.classList.toggle('collapsed', collapsed);
    this.root.toggleAttribute('inert', collapsed);
    this.openButton.hidden = !collapsed;
    this.openButton.setAttribute('aria-expanded', String(!collapsed));
    if (!this.mobile.matches) {
      try {
        localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
      } catch {
        // ignore unavailable storage
      }
    }
    if (!moveFocus) return;
    if (collapsed) this.openButton.focus();
    else this.root.querySelector<HTMLElement>('button, input')?.focus();
  }

  toggle(): void {
    this.setCollapsed(!this.collapsed, true);
  }

  private render(s: AppState): void {
    this.team.render(s);
    this.formations.render(s);
    this.players.render(s);
    this.instructions.render(s);
    this.drawing.render(s);
  }
}
