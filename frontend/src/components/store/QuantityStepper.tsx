'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import { MAX_PER_ITEM } from '@/lib/cart';

interface QuantityStepperProps {
  quantity: number;
  onChange: (quantity: number) => void;
  label: string;
  /** False when the item has sold out since it went into the basket. */
  canIncrease?: boolean;
}

/**
 * The +/− control that an Add button turns into.
 *
 * There is deliberately no "compact" variant. Every button here is a full
 * 44px target (see `.stepper` in globals.css) whether it sits on a product
 * tile or a cart row: a control that shrinks in the cart is a control that
 * gets mis-tapped in the cart, and the cart is where a mis-tap costs money.
 *
 * The whole tile does not become a link once an item is in the basket, so both
 * buttons stop click propagation — otherwise tapping "−" on a card inside a
 * clickable row would also open the product.
 */
export default function QuantityStepper({
  quantity,
  onChange,
  label,
  canIncrease = true,
}: QuantityStepperProps) {
  const atMax = quantity >= MAX_PER_ITEM || !canIncrease;
  // At one, "−" does not decrement — it removes the item entirely. Showing a
  // minus sign for that is a small lie, and the surprise lands hardest on
  // someone who taps it expecting the row to stay put. A bin icon says what
  // will actually happen.
  const willRemove = quantity <= 1;

  return (
    <div className="stepper">
      <button
        type="button"
        aria-label={willRemove ? `Remove ${label} from cart` : `Remove one ${label}`}
        onClick={(event) => {
          event.stopPropagation();
          onChange(quantity - 1);
        }}
      >
        {willRemove ? (
          <Trash2 className="h-5 w-5" aria-hidden />
        ) : (
          <Minus className="h-5 w-5" aria-hidden />
        )}
      </button>

      {/* aria-live so a screen reader announces the new count after a tap,
          rather than leaving the change silent. */}
      <span aria-live="polite" className="min-w-7 text-center tabular-nums">
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
        <Plus className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
