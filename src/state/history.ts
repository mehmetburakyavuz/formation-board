import type { Store, UpdateMeta } from './store';

/** An undoable action. `apply`/`revert` are pure state transitions. */
export interface Command<S> {
  label: string;
  apply(s: S): S;
  revert(s: S): S;
  /** Update hints used when the command is (re)applied or reverted. */
  meta?: UpdateMeta;
}

export const HISTORY_LIMIT = 200;

/** Linear undo/redo stack on top of a store (command pattern). */
export class History<S> {
  private undoStack: Command<S>[] = [];
  private redoStack: Command<S>[] = [];
  private listeners = new Set<() => void>();

  constructor(
    private store: Store<S>,
    private limit = HISTORY_LIMIT,
  ) {}

  /** Applies a command to the store and records it. */
  execute(cmd: Command<S>): void {
    this.store.set(cmd.apply(this.store.state), cmd.meta);
    this.record(cmd);
  }

  /** Records a command whose effect is already in the store (e.g. a finished drag). */
  record(cmd: Command<S>): void {
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    this.notify();
  }

  undo(): boolean {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    this.store.set(cmd.revert(this.store.state), cmd.meta);
    this.redoStack.push(cmd);
    this.notify();
    return true;
  }

  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    this.store.set(cmd.apply(this.store.state), cmd.meta);
    this.undoStack.push(cmd);
    this.notify();
    return true;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get size(): number {
    return this.undoStack.length;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }
}
