export type Listener<S> = (state: S, prev: S) => void;

/** Single source of truth with immutable updates and subscriptions. */
export class Store<S> {
  private listeners = new Set<Listener<S>>();

  constructor(private current: S) {}

  get state(): S {
    return this.current;
  }

  set(next: S): void {
    if (next === this.current) return;
    const prev = this.current;
    this.current = next;
    for (const l of this.listeners) l(next, prev);
  }

  update(fn: (s: S) => S): void {
    this.set(fn(this.current));
  }

  subscribe(listener: Listener<S>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
