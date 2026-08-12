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
    <header className="brand-gradient glass-strong sticky top-0 z-30 border-b border-[rgba(212,175,55,0.18)] text-[var(--color-ink)]">
      {/* A single gold hairline along the bottom edge. The whole header reads
          as one pane of glass, and this is the light catching its lip. */}
      <div className="rule-gold pointer-events-none absolute inset-x-0 bottom-0 h-px" />

      <div className="mx-auto max-w-7xl px-3 pb-3 pt-3 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="bg-gradient-to-br from-[#f4dc93] via-[#d4af37] to-[#b8912a] bg-clip-text text-xl font-black tracking-tight text-transparent">
                {config?.store_name ?? 'eDawr'}
              </span>
              <span className="hidden text-xs font-medium tracking-[0.18em] text-[var(--color-ink-faint)] uppercase sm:inline">
                Fine groceries
              </span>
            </div>

            <div className="mt-1 flex items-center gap-1.5 text-lg font-bold text-[var(--color-ink)]">
              <Timer className="h-5 w-5 text-[var(--color-brand-500)]" aria-hidden />
              <span>Delivery in {config?.promise_minutes ?? 15} minutes</span>
            </div>

            {/* A span, not a button. This was markup for a control that had no
                onClick — it looked tappable, and tapping it did nothing, which
                is worse than not offering it. It is a statement of the delivery
                area, so it is written as one. */}
            <p className="mt-0.5 flex max-w-full items-center gap-1.5 text-sm text-[var(--color-ink-faint)]">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">
                Delivering across {config?.store_city ?? 'Aizawl'}
              </span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onOpenAdmin}
              className="btn-ghost hidden text-sm sm:inline-flex"
            >
              Store admin
            </button>

            <button
              type="button"
              onClick={onOpenCart}
              className="relative flex min-h-[var(--tap-min)] items-center gap-2 rounded-xl border border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.12)] px-3.5 font-bold text-[var(--color-brand-700)] backdrop-blur transition-colors hover:bg-[rgba(212,175,55,0.22)]"
              aria-label={`Open cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
            >
              <ShoppingCart className="h-6 w-6" aria-hidden />
              {cartCount > 0 ? (
                <span className="hidden text-base tabular-nums sm:inline">
                  {formatMoney(cartSubtotal)}
                </span>
              ) : (
                <span className="hidden text-base sm:inline">Cart</span>
              )}
              {cartCount > 0 && (
                // Solid gold with dark ink on it — a count is no use if it
                // cannot be read at 13px.
                <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#f4dc93] to-[#d4af37] px-1.5 text-xs font-black tabular-nums text-[#12100a] shadow-[0_4px_14px_-4px_rgba(212,175,55,0.9)]">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-ink-faint)]"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search milk, bread, eggs…"
            aria-label="Search products"
            /* 56px tall and 17px type. The search box is the fastest route to
               any product in the store, so it is the largest control on the
               screen — and at 17px iOS will not zoom the page when it takes
               focus. */
            className="field h-14 pl-11 pr-14"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="btn-icon absolute right-1 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
