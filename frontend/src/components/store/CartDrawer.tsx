'use client';

/* eslint-disable @next/next/no-img-element -- see ProductCard.tsx */

import { useEffect, useRef } from 'react';
import { AlertTriangle, ImageOff, ShoppingBag, Timer, Trash2, X } from 'lucide-react';
import { assetUrl } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { formatMoney, formatMoneyExact } from '@/lib/format';
import type { BasketQuote, StoreConfig } from '@/types';
import QuantityStepper from './QuantityStepper';

interface CartDrawerProps {
  onClose: () => void;
  onCheckout: () => void;
  quote: BasketQuote | null;
  isQuoting: boolean;
  config: StoreConfig | null;
}

/** Rendered only while open — the parent mounts and unmounts it. */
export default function CartDrawer({
  onClose,
  onCheckout,
  quote,
  isQuoting,
  config,
}: CartDrawerProps) {
  const { lines, count, setQuantity, remove, clear, subtotal } = useCart();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Escape closes, and the body stops scrolling behind the panel — without the
  // second part, scrolling the drawer on a phone scrolls the product grid
  // underneath it once the drawer's own list hits its end.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const unavailableIds = new Set((quote?.unavailable ?? []).map((item) => item.product_id));
  const hasProblems = unavailableIds.size > 0;
  const belowMinimum = quote ? !quote.meets_minimum : false;
  const canCheckout = count > 0 && !isQuoting && !hasProblems && !belowMinimum;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Your cart">
      <button
        type="button"
        aria-label="Close cart"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(22,18,58,0.45)] backdrop-blur-[2px]"
      />

      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3.5">
          <div>
            <h2 className="text-lg font-extrabold">Your cart</h2>
            <p className="text-xs text-[var(--color-ink-faint)]">
              {count} item{count === 1 ? '' : 's'}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="rounded-lg p-2 text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-surface-sunken)]"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        {count === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag className="h-10 w-10 text-[var(--color-ink-faint)]" aria-hidden />
            <p className="font-semibold">Your cart is empty</p>
            <p className="text-sm text-[var(--color-ink-faint)]">
              Add a few things and they will be at your door in{' '}
              {config?.promise_minutes ?? 15} minutes.
            </p>
            <button type="button" onClick={onClose} className="btn-ghost mt-2">
              Start shopping
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 bg-[var(--color-fresh-50)] px-4 py-2.5 text-[0.8rem] font-semibold text-[#0b6b36]">
              <Timer className="h-4 w-4" aria-hidden />
              Arriving in {config?.promise_minutes ?? 15} minutes
            </div>

            <ul className="flex-1 divide-y divide-[var(--color-line)] overflow-y-auto px-4">
              {lines.map((line) => {
                const isUnavailable = unavailableIds.has(line.product.id);
                const problem = quote?.unavailable.find(
                  (item) => item.product_id === line.product.id,
                );

                return (
                  <li key={line.product.id} className="flex gap-3 py-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--color-surface-sunken)]">
                      {line.product.image_url ? (
                        <img
                          src={assetUrl(line.product.image_url)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[var(--color-ink-faint)]">
                          <ImageOff className="h-5 w-5" aria-hidden />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{line.product.name}</p>
                      <p className="text-xs text-[var(--color-ink-faint)]">{line.product.unit}</p>

                      {isUnavailable && (
                        <p className="mt-1 flex items-center gap-1 text-[0.72rem] font-semibold text-[#b91c1c]">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                          {problem?.reason ?? 'No longer available'}
                        </p>
                      )}

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="w-[5.5rem]">
                          <QuantityStepper
                            compact
                            quantity={line.quantity}
                            label={line.product.name}
                            onChange={(next) => setQuantity(line.product, next)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold tabular-nums">
                            {formatMoney(line.product.price * line.quantity)}
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${line.product.name}`}
                            onClick={() => remove(line.product.id)}
                            className="rounded-md p-1.5 text-[var(--color-ink-faint)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[#b91c1c]"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-[var(--color-line)] px-4 py-3">
              {/* Every figure below comes from /api/store/quote — the same code
                  that will produce the final bill. Adding these up here would
                  be a second pricing engine. */}
              <BillRow label="Item total" value={quote?.items_total ?? subtotal} />
              <BillRow
                label="Delivery"
                value={quote?.delivery_fee ?? 0}
                free={quote?.delivery_fee === 0}
              />
              <BillRow label="Handling" value={quote?.handling_fee ?? 0} />

              <div className="mt-2 flex items-center justify-between border-t border-dashed border-[var(--color-line)] pt-2 text-base font-extrabold">
                <span>To pay</span>
                <span className="tabular-nums">
                  {formatMoneyExact(quote?.grand_total ?? subtotal)}
                </span>
              </div>

              {quote && quote.free_delivery_shortfall > 0 && (
                <p className="mt-2 rounded-lg bg-[var(--color-brand-50)] px-3 py-2 text-[0.78rem] font-semibold text-[var(--color-brand-700)]">
                  Add {formatMoney(quote.free_delivery_shortfall)} more for free delivery
                </p>
              )}

              {belowMinimum && config && (
                <p className="mt-2 rounded-lg bg-[#fff1f2] px-3 py-2 text-[0.78rem] font-semibold text-[#b91c1c]">
                  Minimum order is {formatMoney(config.min_order_value)}.
                </p>
              )}

              <button
                type="button"
                onClick={onCheckout}
                disabled={!canCheckout}
                className="btn-primary mt-3 w-full"
              >
                {isQuoting ? 'Updating…' : hasProblems ? 'Fix cart to continue' : 'Choose address'}
              </button>

              <button
                type="button"
                onClick={clear}
                className="mt-2 w-full text-center text-xs font-semibold text-[var(--color-ink-faint)] transition-colors hover:text-[#b91c1c]"
              >
                Empty cart
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function BillRow({ label, value, free }: { label: string; value: number; free?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-sm text-[var(--color-ink-soft)]">
      <span>{label}</span>
      {free ? (
        <span className="font-bold text-[var(--color-fresh-500)]">FREE</span>
      ) : (
        <span className="tabular-nums">{formatMoney(value)}</span>
      )}
    </div>
  );
}
