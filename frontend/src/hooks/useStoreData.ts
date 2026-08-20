'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  getAddressesServerSnapshot,
  getAddressesSnapshot,
  subscribeToAddresses,
} from '@/lib/addresses';
import {
  getServerSnapshot as getCartServerSnapshot,
  getSnapshot as getCartSnapshot,
  subscribe as subscribeToCart,
} from '@/lib/cart-store';
import { tierFor } from '@/lib/delivery';
import { getProfileServerSnapshot, getProfileSnapshot, subscribeToProfile } from '@/lib/profile';
import {
  getRecentOrdersServerSnapshot,
  getRecentOrdersSnapshot,
  subscribeToRecentOrders,
} from '@/lib/recent-orders';
import {
  getRecentSearchesServerSnapshot,
  getRecentSearchesSnapshot,
  subscribeToRecentSearches,
} from '@/lib/recent-searches';
import { fetchStoreConfig } from '@/lib/store-api';
import type { DeliveryType, StoreConfig } from '@/types';

/**
 * The hooks every storefront page reads its ambient state through.
 *
 * The local ones are thin `useSyncExternalStore` wrappers — the reason they are
 * hooks at all is that the three-argument call is easy to get subtly wrong (a
 * missing server snapshot is a hydration mismatch that only shows up in a
 * production build), so it is written once.
 *
 * `useStoreConfig` is the odd one out: it fetches. Note that it never calls
 * `setState` in the body of an effect — only inside a promise callback, which
 * is an async path. Setting state synchronously in an effect is an error in
 * this codebase (`react-hooks/set-state-in-effect`), and the fix is structural
 * rather than a suppression.
 */

export function useCart() {
  return useSyncExternalStore(subscribeToCart, getCartSnapshot, getCartServerSnapshot);
}

export function useAddressBook() {
  return useSyncExternalStore(
    subscribeToAddresses,
    getAddressesSnapshot,
    getAddressesServerSnapshot,
  );
}

export function useProfile() {
  return useSyncExternalStore(subscribeToProfile, getProfileSnapshot, getProfileServerSnapshot);
}

export function useRecentOrders() {
  return useSyncExternalStore(
    subscribeToRecentOrders,
    getRecentOrdersSnapshot,
    getRecentOrdersServerSnapshot,
  );
}

export function useRecentSearches() {
  return useSyncExternalStore(
    subscribeToRecentSearches,
    getRecentSearchesSnapshot,
    getRecentSearchesServerSnapshot,
  );
}

/**
 * The store's own rules: name, city, delivery tiers, fees, the promise.
 *
 * Cached at module scope so the twelve components that want the delivery
 * promise share one request per page load rather than each firing their own.
 * It is configuration, not inventory — it does not change between two renders
 * of the same page, and a stale value costs nothing because **no fee here is
 * ever charged**. Everything that bills the customer comes from
 * `/api/store/quote` and from the order the server creates.
 */
let cached: StoreConfig | null = null;

export function useStoreConfig(): StoreConfig | null {
  const [config, setConfig] = useState<StoreConfig | null>(cached);

  useEffect(() => {
    if (cached) return;

    const controller = new AbortController();
    fetchStoreConfig(controller.signal)
      .then((loaded) => {
        cached = loaded;
        setConfig(loaded);
      })
      .catch(() => {
        // A store that cannot read its own config still sells. The tier
        // fallbacks in `lib/delivery.ts` cover the picker, and the bill was
        // never computed from this in the first place.
      });

    return () => controller.abort();
  }, []);

  return config;
}

/**
 * The promise, in minutes, for a given speed — or null before config lands.
 *
 * Null rather than a guess: an ETA chip that renders "15 min" from a hardcoded
 * default is a promise the store has not made. Better to show nothing for the
 * half second before the real number arrives.
 */
export function usePromiseMinutes(deliveryType?: DeliveryType): number | null {
  const config = useStoreConfig();
  if (!config) return null;
  if (!deliveryType) return config.promise_minutes;
  return tierFor(config, deliveryType).promise_minutes;
}
