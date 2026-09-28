import { describe, expect, it } from 'vitest';
import { Controller } from '../src/app/Controller';
import { History } from '../src/state/history';
import { createInitialState } from '../src/state/initialState';
import type { AppState } from '../src/state/schema';
import { Store } from '../src/state/store';

function edited(): AppState {
  const s = createInitialState();
  return {
    ...s,
    tacticName: 'Pres planı',
    teams: { ...s.teams, home: { ...s.teams.home, name: 'Kırmızılar', color: '#000000' } },
    players: s.players.map((p, i) => (i === 0 ? { ...p, x: p.x + 10, name: 'Kaleci' } : p)),
    ball: { x: 20, z: 5 },
    activeTeam: 'away',
    settings: { ...s.settings, showLabels: false, snap: true },
    drawings: [
      {
        id: 'd1',
        type: 'zone',
        shape: 'rect',
        color: '#ff0000',
        a: { x: 0, z: 0 },
        b: { x: 5, z: 5 },
      } as AppState['drawings'][number],
    ],
  };
}

describe('Controller.resetBoard', () => {
  it('restores the default board but keeps view preferences', () => {
    const store = new Store<AppState>(edited());
    const ctl = new Controller(store, new History(store));
    ctl.resetBoard();
    const s = store.state;
    const fresh = createInitialState();
    expect(s.tacticName).toBe(fresh.tacticName);
    expect(s.teams).toEqual(fresh.teams);
    expect(s.players).toEqual(fresh.players);
    expect(s.ball).toEqual(fresh.ball);
    expect(s.activeTeam).toBe('home');
    expect(s.drawings).toEqual([]);
    expect(s.scenario.frames).toEqual([]);
    expect(s.settings.showLabels).toBe(false);
    expect(s.settings.snap).toBe(true);
  });

  it('is one undo step', () => {
    const before = edited();
    const store = new Store<AppState>(before);
    const ctl = new Controller(store, new History(store));
    ctl.resetBoard();
    ctl.undo();
    expect(store.state.players).toBe(before.players);
    expect(store.state.drawings).toBe(before.drawings);
    expect(store.state.teams).toBe(before.teams);
  });
});
