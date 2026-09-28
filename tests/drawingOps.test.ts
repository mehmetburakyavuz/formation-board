import { describe, expect, it, vi } from 'vitest';

// initialState reads custom formations from localStorage; not needed here.
vi.mock('../src/state/persistence', () => ({
  loadCustomFormations: () => [],
  saveCustomFormations: () => undefined,
}));

const { createInitialState } = await import('../src/state/initialState');
const { Store } = await import('../src/state/store');
const { History } = await import('../src/state/history');
const { Controller } = await import('../src/app/Controller');
const { resolveAnchor } = await import('../src/state/drawingOps');

function setup() {
  const store = new Store(createInitialState());
  const history = new History(store);
  return { store, history, ctl: new Controller(store, history) };
}

describe('drawings', () => {
  it('adds, erases and restores drawings in order with undo/redo', () => {
    const { store, ctl } = setup();
    const zone = {
      id: 'z',
      type: 'zone',
      shape: 'rect',
      a: { x: 0, z: 0 },
      b: { x: 5, z: 5 },
      color: '#f00',
    } as const;
    const note = {
      id: 'n',
      type: 'note',
      anchor: { kind: 'point', x: 1, z: 1 },
      text: 'x',
    } as const;
    ctl.addDrawing(zone);
    ctl.addDrawing(note);
    ctl.removeDrawing('z');
    expect(store.state.drawings.map((d) => d.id)).toEqual(['n']);
    ctl.undo();
    expect(store.state.drawings.map((d) => d.id)).toEqual(['z', 'n']);
    ctl.undo();
    ctl.undo();
    expect(store.state.drawings).toEqual([]);
    ctl.redo();
    expect(store.state.drawings.map((d) => d.id)).toEqual(['z']);
  });

  it('resolves player anchors to the player position (arrows follow)', () => {
    const { store } = setup();
    const p = store.state.players[1];
    expect(resolveAnchor(store.state, { kind: 'player', id: p.id })).toEqual({ x: p.x, z: p.z });
    expect(resolveAnchor(store.state, { kind: 'player', id: 'nope' })).toBeNull();
  });

  it('saveNote creates, edits and deletes (empty text) notes', () => {
    const { store, ctl } = setup();
    const anchor = { kind: 'point', x: 0, z: 0 } as const;
    ctl.saveNote(anchor, '  Pres!  ');
    const note = store.state.drawings[0];
    expect(note.type === 'note' && note.text).toBe('Pres!');
    ctl.saveNote(anchor, 'Geri çekil', note.id);
    expect(store.state.drawings[0].type === 'note' && store.state.drawings[0].text).toBe(
      'Geri çekil',
    );
    ctl.saveNote(anchor, '   ', note.id);
    expect(store.state.drawings).toEqual([]);
    ctl.saveNote(anchor, '');
    expect(store.state.drawings).toEqual([]);
  });

  it('clears all drawings as one undo step', () => {
    const { store, ctl } = setup();
    ctl.saveNote({ kind: 'point', x: 0, z: 0 }, 'a');
    ctl.saveNote({ kind: 'point', x: 1, z: 0 }, 'b');
    ctl.clearDrawings();
    expect(store.state.drawings).toEqual([]);
    ctl.undo();
    expect(store.state.drawings.length).toBe(2);
  });
});

describe('instructions', () => {
  it('toggles on all selected players, then off when all have it', () => {
    const { store, ctl } = setup();
    const [a, b] = store.state.players.slice(1, 3).map((p) => p.id);
    ctl.select([a]);
    ctl.toggleInstruction('overlap');
    ctl.select([a, b]);
    ctl.toggleInstruction('overlap'); // mixed → add to all
    const has = (id: string) =>
      store.state.players.find((p) => p.id === id)?.instructions.includes('overlap');
    expect(has(a) && has(b)).toBe(true);
    ctl.toggleInstruction('overlap'); // all → remove from all
    expect(has(a) || has(b)).toBe(false);
    ctl.undo();
    expect(has(a) && has(b)).toBe(true);
  });
});
