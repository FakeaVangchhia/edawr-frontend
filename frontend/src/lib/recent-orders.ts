/**
 * Remembering the customer's own orders, without an account.
 *
 * Order tracking is authorised by possession of an unguessable token, and that
 * token is handed over exactly once — in the checkout response. If the customer
 * closes the tab, the order is gone as far as they are concerned: there is no
 * login to find it behind, and no way for them to prove it was theirs.
 *
 * So the token is kept in localStorage. It is the same trust model as a paper
 * receipt: whoever holds it can see the order, and losing it means losing
 * access. Clearing site data is therefore destructive, which is worth knowing
 * before treating this as a database.
 *
 * Exposed as an external store, for the same reasons as the cart (see
 * `cart-store.ts`): reading localStorage from an effect would mean setting
 * state synchronously inside one, which is an error in this codebase.
 */

const STORAGE_KEY = 'edawr-recent-orders-v1';
const MAX_REMEMBERED = 10;

export interface RememberedOrder {
  token: string;
  orderId: number;
  placedAt: string;
  total: number;
  itemCount: number;
}

const NONE: RememberedOrder[] = [];

/**
 * `useSyncExternalStore` compares snapshots by reference, so this must be a
 * stable array rather than a fresh parse on every call — otherwise every render
 * sees a "changed" store and loops forever.
 */
let snapshot: RememberedOrder[] = NONE;
let hydrated = false;
const listeners = new Set<() => void>();

function parse(raw: string | null): RememberedOrder[] {
  if (!raw) return NONE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return NONE;

    // localStorage survives deploys, so this may have been written by an older
    // version of this code with a different shape. Validate rather than assume.
    const valid = parsed.filter(
      (entry): entry is RememberedOrder =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as RememberedOrder).token === 'string' &&
        typeof (entry as RememberedOrder).orderId === 'number',
    );
    return valid.length > 0 ? valid : NONE;
  } catch {
    return NONE;
  }
}

function write(next: RememberedOrder[]): void {
  snapshot = next.length > 0 ? next : NONE;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Private browsing throws. The order still exists server-side and the
    // customer still has the URL they were just redirected to.
  }
  for (const listener of listeners) listener();
}

export function readRecentOrders(): RememberedOrder[] {
  if (typeof window === 'undefined') return NONE;
  if (!hydrated) {
    hydrated = true;
    snapshot = parse(window.localStorage.getItem(STORAGE_KEY));
  }
  return snapshot;
}

export function rememberOrder(order: RememberedOrder): void {
  if (typeof window === 'undefined') return;
  const existing = readRecentOrders().filter((entry) => entry.token !== order.token);
  write([order, ...existing].slice(0, MAX_REMEMBERED));
}

export function forgetOrder(token: string): void {
  if (typeof window === 'undefined') return;
  write(readRecentOrders().filter((entry) => entry.token !== token));
}

// --- external store plumbing -------------------------------------------
function onStorage(event: StorageEvent) {
  // Another tab placed or dismissed an order. `key === null` means the whole
  // store was cleared.
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  snapshot = parse(event.newValue);
  for (const listener of listeners) listener();
}

export function subscribeToRecentOrders(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener('storage', onStorage);
    readRecentOrders();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

export function getRecentOrdersSnapshot(): RememberedOrder[] {
  return snapshot;
}

/** The server has no localStorage, so the first render must agree that it is empty. */
export function getRecentOrdersServerSnapshot(): RememberedOrder[] {
  return NONE;
}
