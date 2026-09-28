/** Optional hints travelling with an update (e.g. for the scene to animate the change). */
export interface UpdateMeta {
  /** Animate position changes over this many milliseconds. */
  animateMs?: number;
}

export type Listener<S> = (state: S, prev: S, meta: UpdateMeta) => void;

/** Single source of truth with immutable updates and subscriptions. */
export class Store<S> {
  private listeners = new Set<Listener<S>>();

  constructor(private current: S) {}

  get state(): S {
    return this.current;
  }

  set(next: S, meta: UpdateMeta = {}): void {
    if (next === this.current) return;
    const prev = this.current;
    this.current = next;
    for (const l of this.listeners) l(next, prev, meta);
  }

  update(fn: (s: S) => S, meta?: UpdateMeta): void {
    this.set(fn(this.current), meta);
  }

  subscribe(listener: Listener<S>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
