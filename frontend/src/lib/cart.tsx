'use client';

import { useMemo, useSyncExternalStore } from 'react';
import {
  addOne,
  clearCart,
  getServerSnapshot,
  getSnapshot,
  mergeLines,
  removeLine,
  setQuantity,
  subscribe,
} from './cart-store';
import type { CartLine, StoreProduct } from '@/types';

export { MAX_PER_ITEM } from './cart-store';

interface UseCart {
  lines: CartLine[];
  /** Total number of individual units, for the badge on the cart button. */
  count: number;
  /** Display-only subtotal. The bill always comes from the server. */
  subtotal: number;
  /** False until localStorage has been read, so the UI does not flash empty. */
  isReady: boolean;
  quantityOf: (productId: number) => number;
  add: (product: StoreProduct) => void;
  /** Add many at once, for "Order again". Quantities add to what is there. */
  mergeLines: (lines: CartLine[]) => void;
  setQuantity: (product: StoreProduct, quantity: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
}

/**
 * Read and mutate the basket.
 *
 * No provider: the basket lives in `cart-store.ts` as a module-level external
 * store, so any component can subscribe without being wrapped in anything. That
 * also means two browser tabs stay in sync, which a React context could not do.
 */
export function useCart(): UseCart {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(() => {
    const { lines, hydrated } = snapshot;
    return {
      lines,
      count: lines.reduce((total, line) => total + line.quantity, 0),
      subtotal: lines.reduce((total, line) => total + line.product.price * line.quantity, 0),
      isReady: hydrated,
      quantityOf: (productId: number) =>
        lines.find((line) => line.product.id === productId)?.quantity ?? 0,
      add: addOne,
      mergeLines,
      setQuantity,
      remove: removeLine,
      clear: clearCart,
    };
  }, [snapshot]);
}
