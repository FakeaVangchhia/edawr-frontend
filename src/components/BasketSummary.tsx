'use client';

import { Zap } from 'lucide-react';
import { deliveryFeeLabel, feeForTier, tiersFrom } from '@/lib/delivery';
import { formatMoney, formatMoneyExact } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BasketQuote, DeliveryType, StoreConfig } from '@/types';

/**
 * The bill, and the speed picker that changes it.
 *
 * **Nothing in this file does arithmetic on money.** Every figure is read
 * straight off the `BasketQuote` the server produced, including the total. That
 * is the whole point of `/api/store/quote` existing: adding up line totals in
 * TypeScript would be a second pricing engine, and it would disagree with the
 * first one the day a fee changed.
 *
 * The one number that is compared rather than computed is
 * `free_delivery_shortfall`, and the server calculates that too.
 */

/**
 * A row on the bill.
 *
 * `undefined` renders as "—", never as "Free" or "₹0". A figure that has not
 * come back from the server yet is *unknown*, and telling a customer their
 * delivery is free before the store has said so is a promise the bill then
 * breaks.
 */
function BillRow({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: number | undefined;
  hint?: string;
  emphasis?: boolean;
}) {
  const display =
    value === undefined ? '—' : value === 0 && !emphasis ? 'Free' : formatMoneyExact(value);

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4',
        emphasis && 'border-t pt-3 text-base font-semibold',
      )}
    >
      <dt className={emphasis ? undefined : 'text-muted-foreground'}>
        {label}
        {hint && <span className="ml-1 text-xs text-muted-foreground">{hint}</span>}
      </dt>
      <dd className={cn('num', value === 0 && !emphasis && 'text-amber-foreground')}>{display}</dd>
    </div>
  );
}

export function DeliveryTierPicker({
  config,
  quote,
  selected,
  onSelect,
  disabled,
}: {
  config: StoreConfig | null;
  quote: BasketQuote | null;
  selected: DeliveryType;
  onSelect: (tier: DeliveryType) => void;
  disabled?: boolean;
}) {
  const tiers = tiersFrom(config);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tiers.map((tier) => {
        const active = tier.key === selected;
        const fee = feeForTier(tier, selected, quote);

        return (
          <button
            key={tier.key}
            type="button"
            onClick={() => onSelect(tier.key)}
            disabled={disabled}
            aria-pressed={active}
            className={cn(
              'rounded-3xl border p-4 text-left transition-all duration-300 ease-[var(--ease-apple)] disabled:opacity-60',
              active
                ? 'border-primary bg-secondary'
                : 'border-border/70 hover:border-primary/25 hover:bg-surface',
            )}
          >
            <span className="flex items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-amber-soft">
                <Zap className="size-4 text-amber" aria-hidden />
              </span>
              <span className="text-sm font-semibold">{tier.label}</span>
            </span>
            <span className="num mt-2 block text-xs text-muted-foreground">
              About {tier.promise_minutes} min · {deliveryFeeLabel(fee, formatMoney)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function BillLines({ quote }: { quote: BasketQuote | null }) {
  return (
    <dl className="space-y-3 text-sm">
      <BillRow label="Item total" value={quote?.items_total} />
      <BillRow label="Delivery" value={quote?.delivery_fee} />
      <BillRow label="Handling" value={quote?.handling_fee} />
      <BillRow label="To pay" value={quote?.grand_total} emphasis />
    </dl>
  );
}

/**
 * "Add ₹120 more for free delivery."
 *
 * The shortfall is the server's own figure, not `threshold - subtotal` worked
 * out here. It renders only when there is something to earn: once delivery is
 * already free, the nudge is noise.
 */
export function FreeDeliveryNudge({ quote }: { quote: BasketQuote | null }) {
  if (!quote || quote.free_delivery_shortfall <= 0 || quote.delivery_fee === 0) return null;

  return (
    <p className="rounded-2xl bg-amber-soft px-4 py-3 text-sm text-amber-foreground">
      Add <span className="num font-semibold">{formatMoney(quote.free_delivery_shortfall)}</span>{' '}
      more to get free delivery.
    </p>
  );
}

/** The minimum-order gate, shown when the basket is below it. */
export function MinimumOrderNotice({
  quote,
  config,
}: {
  quote: BasketQuote | null;
  config: StoreConfig | null;
}) {
  if (!quote || quote.meets_minimum || quote.items_total <= 0) return null;

  return (
    <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm text-destructive">
      Orders start at{' '}
      <span className="num font-semibold">
        {config ? formatMoney(config.min_order_value) : 'the store minimum'}
      </span>
      . Add a little more to check out.
    </p>
  );
}
