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

export function readRecentOrders(): RememberedOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is RememberedOrder =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as RememberedOrder).token === 'string' &&
        typeof (entry as RememberedOrder).orderId === 'number',
    );
  } catch {
    return [];
  }
}

export function rememberOrder(order: RememberedOrder): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = readRecentOrders().filter((entry) => entry.token !== order.token);
    const next = [order, ...existing].slice(0, MAX_REMEMBERED);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private browsing throws. The order still exists server-side and the
    // customer still has the URL they were just redirected to.
  }
}

export function forgetOrder(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    const next = readRecentOrders().filter((entry) => entry.token !== token);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* nothing useful to do */
  }
}
