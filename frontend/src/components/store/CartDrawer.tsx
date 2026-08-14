'use client';

/* eslint-disable @next/next/no-img-element -- see ProductCard.tsx */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ImageOff, ShoppingBag, Trash2, X } from 'lucide-react';
import { assetUrl } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { formatMoney, formatMoneyExact } from '@/lib/format';
import type {
  BasketQuote,
  DeliveryType,
  StoreConfig,
  UnavailableItem,
} from '@/types';
import { tierFor, tiersFrom } from '@/lib/delivery';
import { useDialog } from '@/hooks/useDialog';
import QuantityStepper from './QuantityStepper';
import DeliveryTierPicker from './DeliveryTierPicker';

interface CartDrawerProps {
  onClose: () => void;
  onCheckout: () => void;
  quote: BasketQuote | null;
  isQuoting: boolean;
  config: StoreConfig | null;
  deliveryType: DeliveryType;
  onDeliveryTypeChange: (deliveryType: DeliveryType) => void;
  /**
   * Why the last quote failed, if it did. Empty when the basket priced cleanly.
   *
   * Checkout stays disabled either way — without a verified total there is
   * nothing safe to check out with — but the customer is told why and given a
   * retry, instead of a button that says "Updating…" forever.
   */
  quoteError?: string;
  onRetryQuote?: () => void;
  /** Items a checkout attempt rejected with a 409, if there was one. */
  blockedItems?: UnavailableItem[];
}

/** Rendered only while open — the parent mounts and unmounts it. */
export default function CartDrawer({
  onClose,
  onCheckout,
  quote,
  isQuoting,
  quoteError = '',
  onRetryQuote,
  config,
  blockedItems = [],
  deliveryType,
  onDeliveryTypeChange,
}: CartDrawerProps) {
  const { lines, count, setQuantity, remove, clear, subtotal } = useCart();
  const tiers = tiersFrom(config);
  const tier = tierFor(config, deliveryType);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  /**
   * "Empty cart" asks first.
   *
   * It sits directly below the checkout button and undoes every decision the
   * customer has made so far, with no undo. One confident tap should not be
   * able to do that — least of all for someone whose aim is not precise.
   */
  const [isConfirmingClear, setConfirmingClear] = useState(false);

  // Focus in, focus trapped, focus restored, page frozen — see useDialog.
  const dialogRef = useDialog<HTMLDivElement>({
    onClose,
    initialFocusRef: closeButtonRef,
  });

  // Escape lives here rather than in the hook because the checkout sheet needs
  // a different rule for it. The cart has nothing in flight to interrupt.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Two sources: what the quote says right now, and what a failed checkout
  // reported. The second matters because a 409 arrives *after* a successful
  // quote — the item sold out in between — so the quote alone would show the
  // cart as fine.
  const problems = [...(quote?.unavailable ?? []), ...blockedItems];
  const problemById = new Map(problems.map((item) => [item.product_id, item]));
  const hasProblems = problemById.size > 0;
  const belowMinimum = quote ? !quote.meets_minimum : false;
  // Without a quote there is no verified total, so there is nothing safe to
  // check out with.
  const canCheckout = count > 0 && !isQuoting && !hasProblems && !belowMinimum && quote !== null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Your cart"
    >
      <button
        type="button"
        aria-label="Close cart"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(8,14,32,0.45)] backdrop-blur-[3px]"
      />

      <aside className="glass-strong relative flex h-dvh w-full max-w-md flex-col sm:rounded-l-3xl">
        <header className="flex items-center justify-between px-4 py-3.5">
          <div>
            <h2 className="text-xl font-extrabold">Your cart</h2>
            <p className="text-sm text-[var(--color-ink-faint)]">
              {count} item{count === 1 ? '' : 's'}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="btn-icon"
          >
            <X className="h-6 w-6" aria-hidden />
          </button>
        </header>

        {count === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag className="h-10 w-10 text-[var(--color-ink-faint)]" aria-hidden />
            <p className="text-lg font-semibold">Your cart is empty</p>
            <p className="text-base text-[var(--color-ink-faint)]">
              Add a few things and they will be at your door in{' '}
              {tiers[0].promise_minutes} minutes.
            </p>
            <button type="button" onClick={onClose} className="btn-ghost mt-2">
              Start shopping
            </button>
          </div>
        ) : (
          <>
            {/* This was a static "Arriving in 15 minutes" band. It is now the
                choice that produces that number — same place in the layout,
                because the speed and the ETA were always the same fact. */}
            <DeliveryTierPicker
              tiers={tiers}
              selected={deliveryType}
              onSelect={onDeliveryTypeChange}
              quote={quote}
            />

            {/* No separate "Arriving in N minutes" band any more. The picker
                above already states the window on the selected card, and two
                bands saying fifteen minutes is one band too many in a drawer
                that has to fit a basket, a bill and a CTA on a 568px screen. */}

            <ul className="flex-1 divide-y divide-[var(--color-line)] overflow-y-auto px-4">
              {lines.map((line) => {
                const problem = problemById.get(line.product.id);
                const isUnavailable = problem !== undefined;

                return (
                  <li key={line.product.id} className="flex gap-3 py-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--color-surface-sunken)]">
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
                          <ImageOff className="h-6 w-6" aria-hidden />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Wraps to two lines rather than truncating. A truncated
                          grocery name ("Amul Taaza Toned Milk 5…") is exactly
                          the case where the cut-off part is what tells two
                          similar products apart. */}
                      <p className="line-clamp-2 text-base font-semibold">{line.product.name}</p>
                      <p className="text-sm text-[var(--color-ink-faint)]">{line.product.unit}</p>

                      {isUnavailable && (
                        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-danger-600)]">
                          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                          {problem?.reason ?? 'No longer available'}
                        </p>
                      )}

                      {/* Wraps rather than shrinks. The stepper is two 44px tap
                          targets and the bin is a third, which is about 230px
                          of content on a row that has roughly 210px to give on
                          a 320px phone. Squeezing them would have taken the
                          targets below the WCAG floor the stepper exists to
                          hold, so on the narrowest screens the price and bin
                          drop to a second line instead. */}
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                        <div className="w-[8.5rem] shrink-0">
                          <QuantityStepper
                            quantity={line.quantity}
                            label={line.product.name}
                            onChange={(next) => setQuantity(line.product, next)}
                          />
                        </div>
                        <div className="ml-auto flex min-w-0 items-center gap-1">
                          <span className="truncate text-base font-bold tabular-nums">
                            {formatMoney(line.product.price * line.quantity)}
                          </span>
                          {/* Kept alongside the stepper's bin-at-one: this is
                              the one-tap exit for a line with six of something,
                              which would otherwise take six taps. */}
                          <button
                            type="button"
                            aria-label={`Remove ${line.product.name} from cart`}
                            onClick={() => remove(line.product.id)}
                            className="btn-icon text-[var(--color-ink-faint)] hover:text-[var(--color-danger-600)]"
                          >
                            <Trash2 className="h-5 w-5" aria-hidden />
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
                  be a second pricing engine.

                  Until that quote lands, the fee rows show "—" rather than ₹0
                  and the total shows the item subtotal *labelled as such*.
                  Falling back to `subtotal` under a "To pay" heading would
                  quote the customer a number that excludes delivery and
                  handling — lower than what they are about to be charged. */}
              <BillRow label="Item total" value={quote?.items_total ?? subtotal} />
              <BillRow
                // Named, so a screenshot of this bill explains its own fee.
                label={`Delivery · ${tier.label}`}
                value={quote?.delivery_fee}
                free={quote?.delivery_fee === 0}
              />
              <BillRow label="Handling" value={quote?.handling_fee} />

              <div className="mt-2 flex items-center justify-between border-t border-dashed border-[var(--color-line)] pt-2.5 text-xl font-extrabold">
                <span>{quote ? 'To pay' : 'Items'}</span>
                <span className="tabular-nums">
                  {quote ? formatMoneyExact(quote.grand_total) : formatMoneyExact(subtotal)}
                </span>
              </div>
              {!quote && (
                <p className="mt-1 text-sm text-[var(--color-ink-faint)]">
                  Delivery and handling are added once the store confirms your basket.
                </p>
              )}

              {quote && quote.free_delivery_shortfall > 0 && (
                <p className="mt-2 rounded-lg bg-[var(--color-brand-50)] px-3 py-2.5 text-sm font-semibold text-[var(--color-brand-700)]">
                  Add {formatMoney(quote.free_delivery_shortfall)} more for free delivery
                </p>
              )}

              {belowMinimum && config && (
                <p className="mt-2 rounded-lg bg-[var(--color-danger-50)] px-3 py-2.5 text-sm font-semibold text-[var(--color-danger-600)]">
                  Minimum order is {formatMoney(config.min_order_value)}.
                </p>
              )}

              {/* A failed quote is a dead end without this. The button below is
                  disabled until a total exists, so with nothing on screen the
                  customer is left tapping a greyed-out control with no idea
                  what went wrong or what to do about it. */}
              {quoteError && (
                <div className="mt-2 rounded-lg bg-[var(--color-danger-50)] px-3 py-2.5">
                  <p className="text-sm font-semibold text-[var(--color-danger-600)]">
                    {quoteError}
                  </p>
                  {onRetryQuote && (
                    <button
                      type="button"
                      onClick={onRetryQuote}
                      className="btn-ghost mt-2 w-full"
                    >
                      Try again
                    </button>
                  )}
                </div>
              )}

              {/* "Next: your address" rather than "Choose address": it names
                  what happens on tap and says there is another step, so the
                  button can never be mistaken for the one that places the
                  order. Nothing is charged until "Place order" on the next
                  screen. */}
              <button
                type="button"
                onClick={onCheckout}
                disabled={!canCheckout}
                className="btn-primary mt-3 w-full"
              >
                {isQuoting
                  ? 'Updating…'
                  : quoteError
                    ? 'Total unavailable'
                    : hasProblems
                      ? 'Fix cart to continue'
                      : 'Next: your address'}
              </button>

              {isConfirmingClear ? (
                <div className="mt-3 rounded-xl bg-[var(--color-surface-inset)] p-3">
                  <p className="text-base font-semibold">
                    Remove all {count} item{count === 1 ? '' : 's'}?
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingClear(false)}
                      className="btn-ghost flex-1"
                    >
                      Keep them
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        clear();
                        setConfirmingClear(false);
                      }}
                      className="btn-ghost flex-1 bg-[var(--color-danger-50)] text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)] hover:text-[var(--color-danger-600)]"
                    >
                      Yes, empty
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingClear(true)}
                  className="mt-2 min-h-[var(--tap-min)] w-full text-center text-sm font-semibold text-[var(--color-ink-faint)] transition-colors hover:text-[var(--color-danger-600)]"
                >
                  Empty cart
                </button>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function BillRow({
  label,
  value,
  free,
}: {
  label: string;
  value: number | undefined;
  free?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-base text-[var(--color-ink-soft)]">
      <span>{label}</span>
      {value === undefined ? (
        // Not "₹0" — a fee that has not been calculated yet is unknown, not free.
        <span className="text-[var(--color-ink-faint)]">—</span>
      ) : free ? (
        // No colour on it. "Free" is the only word in a column of numerals,
        // which is already the strongest signal available — and the green it
        // used to be is not in this palette.
        <span className="font-bold text-[var(--color-ink)]">Free</span>
      ) : (
        <span className="tabular-nums">{formatMoney(value)}</span>
      )}
    </div>
  );
}
