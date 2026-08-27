import type { CartLine, StoreProduct } from '@/types';

/**
 * The basket, modelled as an external store rather than component state.
 *
 * localStorage genuinely *is* an external store, and treating it as one buys
 * three things the usual "read it in a useEffect" approach does not:
 *
 *   1. No hydration mismatch. The server snapshot is always empty, so the
 *      server-rendered HTML and the first client render agree; the real basket
 *      arrives on the next tick.
 *   2. Cross-tab sync for free. Two open tabs share one basket, because the
 *      `storage` event tells the other tab to re-read.
 *   3. No cascading render from setting state inside an effect.
 *
 * **The basket is not the bill.** Line prices here are a snapshot taken when
 * the customer tapped Add, used for display only. Every figure that is actually
 * charged comes from `/api/store/quote` and finally from the order the server
 * creates. A cart that computed its own total would be a second pricing engine.
 */

const STORAGE_KEY = 'edawr-cart-v1';

/**
 * Mirrors MAX_QUANTITY_PER_ITEM in the backend settings. The server is the
 * authority and rejects anything above its own limit; this exists so the
 * stepper stops rather than letting someone tap up to 40 and fail at checkout.
 */
export const MAX_PER_ITEM = 20;

export interface CartSnapshot {
  lines: CartLine[];
  /** False until localStorage has been read, so the UI can avoid flashing. */
  hydrated: boolean;
}

/**
 * Returned by `getServerSnapshot`, and by `getSnapshot` before hydration.
 * A single frozen object: `useSyncExternalStore` compares snapshots by
 * reference and would re-render forever if this allocated a new one each call.
 */
const NO_LINES: CartLine[] = [];
const EMPTY: CartSnapshot = Object.freeze({ lines: NO_LINES, hydrated: false });

let snapshot: CartSnapshot = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function parse(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Anything in localStorage is untrusted input: it survives deploys, so it
    // may have been written by an older version of this code with a different
    // shape. Validate rather than assume.
    return parsed.filter(
      (line): line is CartLine =>
        typeof line === 'object' &&
        line !== null &&
        typeof (line as CartLine).product?.id === 'number' &&
        typeof (line as CartLine).product?.price === 'number' &&
        typeof (line as CartLine).quantity === 'number' &&
        (line as CartLine).quantity > 0,
    );
  } catch {
    return [];
  }
}

function commit(lines: CartLine[], { persist = true } = {}) {
  snapshot = { lines, hydrated: true };
  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Private browsing and a full quota both throw. Losing the saved basket
      // is survivable; crashing the page over it is not.
    }
  }
  emit();
}

function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  commit(parse(window.localStorage.getItem(STORAGE_KEY)), { persist: false });
}

function onStorage(event: StorageEvent) {
  // Another tab changed the basket. `key === null` means the whole store was
  // cleared, which should empty this tab's basket too.
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  commit(parse(event.newValue), { persist: false });
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  // The first subscriber is what triggers hydration. React calls `subscribe`
  // from inside an effect, so this runs on the client only, after mount.
  if (listeners.size === 1) {
    window.addEventListener('storage', onStorage);
    hydrate();
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('storage', onStorage);
    }
  };
}

export function getSnapshot(): CartSnapshot {
  return snapshot;
}

export function getServerSnapshot(): CartSnapshot {
  return EMPTY;
}

// --- mutations ---------------------------------------------------------
export function setQuantity(product: StoreProduct, quantity: number): void {
  const clamped = Math.max(0, Math.min(Math.trunc(quantity), MAX_PER_ITEM));
  const current = snapshot.lines;

  if (clamped === 0) {
    commit(current.filter((line) => line.product.id !== product.id));
    return;
  }

  const exists = current.some((line) => line.product.id === product.id);
  commit(
    exists
      ? current.map((line) =>
          // Refresh the product snapshot too: if the catalogue reloaded with a
          // new price, show the newer one rather than the price from whenever
          // this item was first added.
          line.product.id === product.id ? { product, quantity: clamped } : line,
        )
      : [...current, { product, quantity: clamped }],
  );
}

export function addOne(product: StoreProduct): void {
  const existing = snapshot.lines.find((line) => line.product.id === product.id);
  setQuantity(product, (existing?.quantity ?? 0) + 1);
}

export function removeLine(productId: number): void {
  commit(snapshot.lines.filter((line) => line.product.id !== productId));
}

/**
 * Add several products at once — what "Order again" needs.
 *
 * One commit rather than a loop of `addOne`, which would write localStorage and
 * notify every subscriber once per item: a twelve-item repeat order would
 * re-render the whole grid twelve times and briefly show a basket that is
 * partly filled.
 *
 * Quantities *add* to what is already there, matching what a customer expects
 * when they repeat an order on top of a basket they had already started, and
 * each one is clamped to MAX_PER_ITEM so the merge can never produce a line the
 * server would reject.
 */
export function mergeLines(incoming: CartLine[]): void {
  if (incoming.length === 0) return;

  const merged = [...snapshot.lines];

  for (const line of incoming) {
    const quantity = Math.trunc(line.quantity);
    if (quantity <= 0) continue;

    const index = merged.findIndex((existing) => existing.product.id === line.product.id);
    if (index === -1) {
      merged.push({ product: line.product, quantity: Math.min(quantity, MAX_PER_ITEM) });
    } else {
      merged[index] = {
        // The incoming product snapshot wins: it was just fetched, so its price
        // is fresher than whatever was in the basket from an earlier visit.
        product: line.product,
        quantity: Math.min(merged[index].quantity + quantity, MAX_PER_ITEM),
      };
    }
  }

  commit(merged);
}

export function clearCart(): void {
  commit([]);
}
