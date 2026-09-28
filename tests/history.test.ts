import { describe, expect, it } from 'vitest';
import { History, type Command } from '../src/state/history';
import { Store } from '../src/state/store';

interface S {
  n: number;
}

const add = (k: number): Command<S> => ({
  label: `add ${k}`,
  apply: (s) => ({ n: s.n + k }),
  revert: (s) => ({ n: s.n - k }),
});

describe('History', () => {
  it('executes, undoes and redoes', () => {
    const store = new Store<S>({ n: 0 });
    const h = new History(store);
    h.execute(add(2));
    h.execute(add(3));
    expect(store.state.n).toBe(5);
    expect(h.undo()).toBe(true);
    expect(store.state.n).toBe(2);
    expect(h.redo()).toBe(true);
    expect(store.state.n).toBe(5);
  });

  it('returns false when there is nothing to undo/redo', () => {
    const h = new History(new Store<S>({ n: 0 }));
    expect(h.undo()).toBe(false);
    expect(h.redo()).toBe(false);
    expect(h.canUndo).toBe(false);
  });

  it('clears the redo stack on a new action', () => {
    const store = new Store<S>({ n: 0 });
    const h = new History(store);
    h.execute(add(1));
    h.undo();
    expect(h.canRedo).toBe(true);
    h.execute(add(5));
    expect(h.canRedo).toBe(false);
    expect(store.state.n).toBe(5);
  });

  it('records already-applied commands without re-applying them', () => {
    const store = new Store<S>({ n: 0 });
    const h = new History(store);
    store.set({ n: 7 }); // e.g. a finished drag
    h.record(add(7));
    expect(store.state.n).toBe(7);
    h.undo();
    expect(store.state.n).toBe(0);
  });

  it('keeps at least 100 steps and drops the oldest beyond the limit', () => {
    const store = new Store<S>({ n: 0 });
    const h = new History(store, 100);
    for (let i = 0; i < 150; i++) h.execute(add(1));
    expect(h.size).toBe(100);
    let undone = 0;
    while (h.undo()) undone++;
    expect(undone).toBe(100);
    expect(store.state.n).toBe(50);
  });

  it('notifies subscribers and passes command meta to the store', () => {
    const store = new Store<S>({ n: 0 });
    const h = new History(store);
    const metas: (number | undefined)[] = [];
    store.subscribe((_s, _p, meta) => metas.push(meta.animateMs));
    let calls = 0;
    h.subscribe(() => calls++);
    h.execute({ ...add(1), meta: { animateMs: 900 } });
    h.undo();
    expect(calls).toBe(2);
    expect(metas).toEqual([900, 900]);
  });
});
