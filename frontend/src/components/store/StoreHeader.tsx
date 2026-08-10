'use client';

import { MapPin, Search, ShoppingCart, Timer, X } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import type { StoreConfig } from '@/types';

interface StoreHeaderProps {
  config: StoreConfig | null;
  search: string;
  onSearchChange: (value: string) => void;
  cartCount: number;
  cartSubtotal: number;
  onOpenCart: () => void;
  onOpenAdmin: () => void;
}

/**
 * The band at the top of the store.
 *
 * The delivery promise is the headline because it is the product: a customer
 * chooses this kind of store for the number of minutes, not the catalogue. It
 * is rendered from `config.promise_minutes`, which the API serves from the same
 * setting each order snapshots at checkout — so the promise on screen and the
 * promise on the receipt cannot drift apart.
 */
export default function StoreHeader({
  config,
  search,
  onSearchChange,
  cartCount,
  cartSubtotal,
  onOpenCart,
  onOpenAdmin,
}: StoreHeaderProps) {
  return (
    <header className="brand-gradient sticky top-0 z-30 text-white">
      <div className="mx-auto max-w-7xl px-3 pb-3 pt-3 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black tracking-tight">
                {config?.store_name ?? 'eDawr'}
              </span>
              <span className="hidden text-[0.7rem] font-medium text-white/60 sm:inline">
                groceries, fast
              </span>
            </div>

            <div className="mt-1 flex items-center gap-1.5 text-[0.95rem] font-bold">
              <Timer className="h-4 w-4 text-[#ffd166]" aria-hidden />
              <span>Delivery in {config?.promise_minutes ?? 15} minutes</span>
            </div>

            <button
              type="button"
              className="mt-0.5 flex max-w-full items-center gap-1 text-left text-[0.78rem] text-white/70"
              title="Delivery area"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                Delivering across {config?.store_city ?? 'Aizawl'}
              </span>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onOpenAdmin}
              className="hidden rounded-lg border border-white/25 px-3 py-1.5 text-xs font-semibold text-white/85 transition-colors hover:bg-white/10 sm:block"
            >
              Store admin
            </button>

            <button
              type="button"
              onClick={onOpenCart}
              className="relative flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 font-bold backdrop-blur transition-colors hover:bg-white/25"
              aria-label={`Open cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
            >
              <ShoppingCart className="h-4.5 w-4.5" aria-hidden />
              {cartCount > 0 ? (
                <span className="hidden text-sm tabular-nums sm:inline">
                  {formatMoney(cartSubtotal)}
                </span>
              ) : (
                <span className="hidden text-sm sm:inline">Cart</span>
              )}
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-accent-500)] px-1 text-[0.7rem] font-black tabular-nums">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-faint)]"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder='Search for "milk", "bread", "eggs"'
            aria-label="Search products"
            className="h-11 w-full rounded-xl border-0 bg-white pl-10 pr-10 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-faint)]"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[var(--color-ink-faint)] transition-colors hover:bg-[var(--color-surface-sunken)]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
