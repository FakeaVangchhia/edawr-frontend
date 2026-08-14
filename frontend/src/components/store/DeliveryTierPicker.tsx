'use client';

import { Timer } from 'lucide-react';
import type { BasketQuote, DeliveryTier, DeliveryType } from '@/types';
import { deliveryFeeLabel, feeForTier } from '@/lib/delivery';
import { formatMoney } from '@/lib/format';

interface DeliveryTierPickerProps {
  tiers: DeliveryTier[];
  selected: DeliveryType;
  onSelect: (deliveryType: DeliveryType) => void;
  quote: BasketQuote | null;
}

/**
 * How fast, and what that costs.
 *
 * **Real radio inputs, not styled buttons.** A radio group gives one tab stop
 * for the whole control, arrow keys to move between options, and an
 * announcement of "Delivery speed, Instant, radio button, 1 of 2, selected" —
 * all of it for free and all of it correct. Rebuilding that on `<button>`s
 * means `role="radiogroup"`, a roving `tabIndex` and hand-written arrow
 * handlers, and it would still be subtly wrong somewhere.
 *
 * The selected option is marked three ways — the filled dot, the amber border,
 * and the radio's own checked state — so it survives a monochrome screen and a
 * screen reader equally.
 *
 * The inputs stay enabled while a re-quote is in flight. Switching speed should
 * feel instant; it is the numbers that go to '—', not the control.
 */
export default function DeliveryTierPicker({
  tiers,
  selected,
  onSelect,
  quote,
}: DeliveryTierPickerProps) {
  return (
    <fieldset className="px-4 py-3">
      <legend className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[var(--color-ink)]">
        <Timer className="h-4 w-4 text-[var(--color-brand-500)]" aria-hidden />
        Delivery speed
      </legend>

      <div className="grid grid-cols-2 gap-2">
        {tiers.map((tier) => {
          const isSelected = tier.key === selected;
          const fee = feeForTier(tier, selected, quote);

          return (
            /* Filled, never outlined. The selected option is an amber wash, the
               unselected one is the recessed grey every other secondary control
               uses — so the pair reads as a two-position switch rather than as
               two boxes. */
            <label
              key={tier.key}
              className={`relative flex min-h-[var(--tap-min)] cursor-pointer flex-col gap-0.5 rounded-2xl px-3 py-2.5 transition-colors duration-quick ease-glide ${
                isSelected
                  ? 'bg-[var(--color-brand-50)]'
                  : 'bg-[var(--color-surface-inset)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              {/* Visually hidden, but a real focused input — the ring below is
                  driven by its focus state, so keyboard users get the same cue
                  as everyone else. */}
              <input
                type="radio"
                name="delivery-tier"
                value={tier.key}
                checked={isSelected}
                onChange={() => onSelect(tier.key)}
                className="peer sr-only"
              />

              <span className="pointer-events-none absolute inset-0 rounded-2xl peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-navy-900)]" />

              <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--color-ink)] sm:text-base">
                {/* The dot is the one ring left in the design, and it is a
                    radio: removing it would leave selection carried by fill
                    alone, which is exactly the state a real radio group is
                    supposed to expose. */}
                <span
                  aria-hidden
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors ${
                    isSelected
                      ? 'bg-[var(--color-brand-500)]'
                      : 'bg-[var(--color-surface)] ring-2 ring-inset ring-[var(--color-surface-hover)]'
                  }`}
                >
                  {isSelected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-navy-900)]" />
                  )}
                </span>
                {tier.label}
              </span>

              <span className="text-xs text-[var(--color-ink-faint)] sm:text-sm">
                in {tier.promise_minutes} min
              </span>

              <span className="text-sm font-bold tabular-nums text-[var(--color-ink)]">
                {deliveryFeeLabel(fee, formatMoney)}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
