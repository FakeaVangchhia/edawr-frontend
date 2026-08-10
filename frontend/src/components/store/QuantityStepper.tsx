'use client';

import { Minus, Plus } from 'lucide-react';
import { MAX_PER_ITEM } from '@/lib/cart';

interface QuantityStepperProps {
  quantity: number;
  onChange: (quantity: number) => void;
  label: string;
  compact?: boolean;
  /** False when the item has sold out since it went into the basket. */
  canIncrease?: boolean;
}

/**
 * The +/- control that an ADD button turns into.
 *
 * The whole tile does not become a link once an item is in the basket, so both
 * buttons stop click propagation — otherwise tapping "−" on a card inside a
 * clickable row would also open the product.
 */
export default function QuantityStepper({
  quantity,
  onChange,
  label,
  compact = false,
  canIncrease = true,
}: QuantityStepperProps) {
  const atMax = quantity >= MAX_PER_ITEM || !canIncrease;

  return (
    <div className={`stepper ${compact ? 'text-xs' : 'text-sm'}`}>
      <button
        type="button"
        aria-label={`Remove one ${label}`}
        onClick={(event) => {
          event.stopPropagation();
          onChange(quantity - 1);
        }}
      >
        <Minus className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
      </button>

      {/* aria-live so a screen reader announces the new count after a tap,
          rather than leaving the change silent. */}
      <span aria-live="polite" className="min-w-6 text-center tabular-nums">
        {quantity}
      </span>

      <button
        type="button"
        aria-label={
          !canIncrease
            ? `${label} is out of stock`
            : atMax
              ? `Maximum ${MAX_PER_ITEM} per item`
              : `Add one more ${label}`
        }
        disabled={atMax}
        onClick={(event) => {
          event.stopPropagation();
          onChange(quantity + 1);
        }}
      >
        <Plus className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
      </button>
    </div>
  );
}
