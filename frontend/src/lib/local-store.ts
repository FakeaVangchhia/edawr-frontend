/**
 * The localStorage-backed external store, factored out.
 *
 * `cart-store.ts` and `recent-orders.ts` each hand-roll this pattern, and they
 * predate it — the third and fourth copy is where it stops being worth writing
 * out. The pattern itself is not negotiable in this codebase, for the reasons
 * documented at length in `cart-store.ts`:
 *
 *   1. **No hydration mismatch.** The server snapshot is always the empty
 *      value, so server-rendered HTML and the first client render agree. The
 *      real data arrives on the next tick.
 *   2. **Cross-tab sync for free**, via the `storage` event.
 *   3. **No state set synchronously inside an effect**, which is an error here
 *      (`react-hooks/set-state-in-effect`) rather than a style preference.
 *
 * The subtlety that makes or breaks it: `useSyncExternalStore` compares
 * snapshots **by reference**. A `getSnapshot` that parses JSON on every call
 * returns a new object each time, React sees a changed store on every render,
 * and the page loops forever. So the parsed value is cached in `snapshot` and
 * only replaced when something actually writes.
 */

export interface LocalStore<T> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  read: () => T;
  write: (next: T) => void;
}

export interface LocalStoreOptions<T> {
  key: string;
  /** Returned before hydration, on the server, and when parsing fails. */
  empty: T;
  /**
   * Anything in localStorage is untrusted input: it survives deploys, so it may
   * have been written by an older version of this code with a different shape.
   * Return `null` to fall back to `empty` rather than handing a broken value to
   * a component that will throw inside `.map()` during render.
   */
  parse: (raw: unknown) => T | null;
}

export function createLocalStore<T>({ key, empty, parse }: LocalStoreOptions<T>): LocalStore<T> {
  let snapshot: T = empty;
  let hydrated = false;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const decode = (raw: string | null): T => {
    if (!raw) return empty;
    try {
      return parse(JSON.parse(raw)) ?? empty;
    } catch {
      return empty;
    }
  };

  const read = (): T => {
    if (typeof window === 'undefined') return empty;
    if (!hydrated) {
      hydrated = true;
      snapshot = decode(window.localStorage.getItem(key));
    }
    return snapshot;
  };

  const write = (next: T): void => {
    if (typeof window === 'undefined') return;
    hydrated = true;
    snapshot = next;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Private browsing and a full quota both throw. Losing the saved value is
      // survivable; crashing the page over it is not.
    }
    emit();
  };

  const onStorage = (event: StorageEvent) => {
    // Another tab wrote. `key === null` means the whole store was cleared.
    if (event.key !== null && event.key !== key) return;
    snapshot = decode(event.newValue);
    emit();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      // React calls `subscribe` from inside an effect, so the first subscriber
      // is what triggers hydration — on the client only, after mount.
      if (listeners.size === 1) {
        window.addEventListener('storage', onStorage);
        read();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener('storage', onStorage);
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => empty,
    read,
    write,
  };
}
