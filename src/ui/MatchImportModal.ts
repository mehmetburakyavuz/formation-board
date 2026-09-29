import type { Controller } from '../app/Controller';
import {
  fetchFixtures,
  fetchLineups,
  loadApiKey,
  MatchApiError,
  saveApiKey,
  type ApiFixture,
} from '../data/matchImport/apiClient';
import { LineupError, mapLineup } from '../data/matchImport/mapLineup';
import { tr } from '../i18n/tr';
import { el } from './dom';

type Notify = (message: string, kind?: 'info' | 'error') => void;

/** Rows shown at once; a day can have hundreds of fixtures. */
const MAX_ROWS = 80;

const timeFmt = new Intl.DateTimeFormat('tr-TR', { timeStyle: 'short' });

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function errorText(e: unknown): string {
  const E = tr.matchImport.errors;
  if (e instanceof LineupError) return E.badLineup;
  if (!(e instanceof MatchApiError)) return E.network;
  switch (e.kind) {
    case 'plan':
      return E.plan(e.message);
    case 'api':
      return E.api(e.message);
    default:
      return E[e.kind];
  }
}

/** Dialog: pick a day's fixture from API-Football and load both starting line-ups. */
export class MatchImportModal {
  readonly root: HTMLDialogElement;
  private keyInput: HTMLInputElement;
  private dateInput: HTMLInputElement;
  private filterInput: HTMLInputElement;
  private status: HTMLParagraphElement;
  private list: HTMLUListElement;
  /** Fixtures per date, so re-opening or filtering costs no requests. */
  private cache = new Map<string, ApiFixture[]>();
  private fixtures: ApiFixture[] = [];
  private busy = false;

  constructor(
    private ctl: Controller,
    private notify: Notify,
  ) {
    const M = tr.matchImport;
    this.keyInput = el('input', {
      class: 'text-input',
      type: 'password',
      autocomplete: 'off',
      spellcheck: 'false',
      'aria-label': M.keyPlaceholder,
      placeholder: M.keyPlaceholder,
    });
    const keyForm = el('form', { class: 'inline-form' }, [
      this.keyInput,
      el('button', { class: 'btn', type: 'submit' }, [M.keySave]),
    ]);
    keyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveApiKey(this.keyInput.value.trim());
      this.notify(M.keySaved);
    });

    this.dateInput = el('input', { class: 'text-input', type: 'date', 'aria-label': M.date });
    const dateForm = el('form', { class: 'inline-form' }, [
      this.dateInput,
      el('button', { class: 'btn btn-primary', type: 'submit' }, [M.fetch]),
    ]);
    dateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.loadFixtures();
    });

    this.filterInput = el('input', {
      class: 'text-input',
      type: 'search',
      'aria-label': M.filter,
      placeholder: M.filter,
    });
    this.filterInput.addEventListener('input', () => this.renderList());

    this.status = el('p', { class: 'library-meta', role: 'status' });
    this.list = el('ul', { class: 'library-list', 'aria-label': M.matchSection });

    const closeBtn = el('button', { class: 'btn', type: 'button' }, [M.close]);
    closeBtn.addEventListener('click', () => this.close());

    this.root = el(
      'dialog',
      { class: 'panel modal library-modal match-modal', 'aria-labelledby': 'match-title' },
      [
        el('h2', { id: 'match-title' }, [M.title]),
        el('section', { class: 'modal-section' }, [
          el('h3', {}, [M.keySection]),
          keyForm,
          el('p', { class: 'library-meta' }, [M.keyHint]),
        ]),
        el('section', { class: 'modal-section' }, [
          el('h3', {}, [M.matchSection]),
          dateForm,
          this.filterInput,
          this.status,
          this.list,
        ]),
        el('div', { class: 'help-actions' }, [closeBtn]),
      ],
    );
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });
  }

  private get key(): string {
    return this.keyInput.value.trim();
  }

  private setBusy(on: boolean, message = ''): void {
    this.busy = on;
    this.root.toggleAttribute('aria-busy', on);
    this.status.textContent = on ? tr.matchImport.loading : message;
  }

  private async loadFixtures(): Promise<void> {
    const date = this.dateInput.value;
    if (!date || this.busy) return;
    const cached = this.cache.get(date);
    if (cached) {
      this.fixtures = cached;
      this.renderList();
      return;
    }
    this.setBusy(true);
    this.list.replaceChildren();
    try {
      const all = await fetchFixtures(date, this.key);
      all.sort(
        (a, b) =>
          a.league.country.localeCompare(b.league.country) ||
          a.league.name.localeCompare(b.league.name) ||
          a.fixture.date.localeCompare(b.fixture.date),
      );
      saveApiKey(this.key);
      this.cache.set(date, all);
      this.fixtures = all;
      this.setBusy(false);
      this.renderList();
    } catch (e) {
      this.fixtures = [];
      this.setBusy(false, errorText(e));
    }
  }

  private renderList(): void {
    const M = tr.matchImport;
    const q = this.filterInput.value.trim().toLocaleLowerCase('tr');
    const matches = q
      ? this.fixtures.filter((f) =>
          [f.teams.home.name, f.teams.away.name, f.league.name, f.league.country]
            .join(' ')
            .toLocaleLowerCase('tr')
            .includes(q),
        )
      : this.fixtures;
    if (this.fixtures.length === 0) this.status.textContent = M.empty;
    else if (matches.length === 0) this.status.textContent = M.noMatchForFilter;
    else if (matches.length > MAX_ROWS) this.status.textContent = M.more(matches.length - MAX_ROWS);
    else this.status.textContent = '';
    this.list.replaceChildren(...matches.slice(0, MAX_ROWS).map((f) => this.row(f)));
  }

  private row(f: ApiFixture): HTMLLIElement {
    const M = tr.matchImport;
    const { home, away } = f.teams;
    const score =
      f.goals.home === null || f.goals.away === null ? '–' : `${f.goals.home}–${f.goals.away}`;
    const time = timeFmt.format(new Date(f.fixture.date));
    const btn = el(
      'button',
      {
        class: 'btn btn-primary',
        type: 'button',
        'aria-label': M.importLabel(home.name, away.name),
      },
      [M.importBtn],
    );
    btn.addEventListener('click', () => void this.importFixture(f));
    return el('li', { class: 'library-item' }, [
      el('div', { class: 'library-info' }, [
        el('span', { class: 'library-name' }, [`${home.name} ${score} ${away.name}`]),
        el('span', { class: 'library-meta' }, [
          `${f.league.country} · ${f.league.name} · ${time} · ${f.fixture.status.short}`,
        ]),
      ]),
      btn,
    ]);
  }

  private async importFixture(f: ApiFixture): Promise<void> {
    if (this.busy) return;
    this.setBusy(true);
    try {
      const lineups = await fetchLineups(f.fixture.id, this.key);
      const byTeam = (id: number) => lineups.find((l) => l.team.id === id);
      const home = byTeam(f.teams.home.id);
      const away = byTeam(f.teams.away.id);
      if (!home || !away || home.startXI.length === 0 || away.startXI.length === 0) {
        this.setBusy(false, tr.matchImport.errors.noLineup);
        return;
      }
      const h = mapLineup(home);
      const a = mapLineup(away);
      this.setBusy(false);
      this.ctl.importMatch(h, a);
      this.close();
      this.notify(tr.matchImport.imported(h.name, a.name));
    } catch (e) {
      this.setBusy(false, errorText(e));
    }
  }

  open(): void {
    if (this.root.open) return;
    this.keyInput.value = loadApiKey();
    if (!this.dateInput.value) this.dateInput.value = yesterday();
    this.root.showModal();
    (this.key ? this.dateInput : this.keyInput).focus();
  }

  close(): void {
    if (this.root.open) this.root.close();
  }
}
