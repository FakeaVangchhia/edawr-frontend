'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Loader2, Wallet } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { formatMoneyExact } from '@/lib/format';
import { placeOrder, type CheckoutDetails } from '@/lib/store-api';
import { rememberOrder } from '@/lib/recent-orders';
import type { BasketQuote, TrackedOrder, UnavailableItem } from '@/types';

interface CheckoutSheetProps {
  onClose: () => void;
  onPlaced: (order: TrackedOrder) => void;
  onUnavailable: (items: UnavailableItem[]) => void;
  quote: BasketQuote | null;
}

interface FieldErrors {
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
}

/**
 * Mirrors `normalise_phone` in `backend/api/validators.py`, **including its
 * length conditions**.
 *
 * The country code is only stripped when there are 12 digits, and a trunk zero
 * only when there are 11. Stripping a leading "91" unconditionally would reject
 * `9123456789` — a perfectly valid ten-digit Indian mobile that happens to start
 * with 91 — leaving that customer unable to check out at all, with a message
 * insisting their own number is invalid.
 */
export function isValidIndianMobile(input: string): boolean {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return /^[6-9]\d{9}$/.test(digits);
}

/**
 * Address and contact details, then place the order.
 *
 * Validation here is a courtesy, not a control: the server validates the same
 * fields and is the only thing that decides whether an order is acceptable.
 * This exists so a customer finds out about a missing house number before the
 * round trip, not so the backend can trust the input.
 */
/** Rendered only while open — the parent mounts and unmounts it. */
export default function CheckoutSheet({
  onClose,
  onPlaced,
  onUnavailable,
  quote,
}: CheckoutSheetProps) {
  const { lines, clear } = useCart();
  const [details, setDetails] = useState<CheckoutDetails>({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    customer_landmark: '',
    delivery_notes: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Moving focus is a DOM side effect, not a state update — this is exactly
  // what effects are for. The form starts empty because the component is
  // freshly mounted each time it opens.
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Never yank the sheet away mid-submit: the order may already be placed.
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, isSubmitting]);

  const update = (field: keyof CheckoutDetails, value: string) => {
    setDetails((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (details.customer_name.trim().length < 2) {
      errors.customer_name = 'Who should the rider ask for?';
    }
    if (!isValidIndianMobile(details.customer_phone)) {
      errors.customer_phone = 'Enter a valid 10-digit mobile number.';
    }
    if (details.customer_address.trim().length < 8) {
      errors.customer_address = 'Add a full address a rider could find.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const order = await placeOrder(lines, {
        ...details,
        customer_name: details.customer_name.trim(),
        customer_address: details.customer_address.trim(),
      });

      // Remembered before the cart is cleared, so a customer who closes the tab
      // on the confirmation screen can still find the order — there is no
      // account to look it up from.
      rememberOrder({
        token: order.tracking_token,
        orderId: order.id,
        placedAt: order.created_at,
        total: order.grand_total,
        itemCount: order.items.length,
      });
      clear();
      onPlaced(order);
    } catch (error) {
      if (error instanceof ApiError && error.isConflict) {
        const items = (error.payload.unavailable as UnavailableItem[]) ?? [];
        onUnavailable(items);
        setFormError(error.message);
      } else if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError('Could not place the order. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Delivery details"
    >
      <button
        type="button"
        aria-label="Back to cart"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(22,18,58,0.45)] backdrop-blur-[2px]"
      />

      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-3.5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to cart"
            className="rounded-lg p-2 text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-surface-sunken)]"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <h2 className="text-lg font-extrabold">Delivery details</h2>
        </header>

        <form onSubmit={submit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="space-y-3.5 px-4 py-4">
            <Field
              label="Full name"
              error={fieldErrors.customer_name}
              input={
                <input
                  ref={nameRef}
                  className={`field ${fieldErrors.customer_name ? 'field-invalid' : ''}`}
                  value={details.customer_name}
                  onChange={(event) => update('customer_name', event.target.value)}
                  autoComplete="name"
                  placeholder="Lalrinsangi"
                />
              }
            />

            <Field
              label="Mobile number"
              hint="The rider will call this number."
              error={fieldErrors.customer_phone}
              input={
                <input
                  className={`field ${fieldErrors.customer_phone ? 'field-invalid' : ''}`}
                  value={details.customer_phone}
                  onChange={(event) => update('customer_phone', event.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="98123 45678"
                />
              }
            />

            <Field
              label="Delivery address"
              error={fieldErrors.customer_address}
              input={
                <textarea
                  className={`field min-h-20 resize-y ${fieldErrors.customer_address ? 'field-invalid' : ''}`}
                  value={details.customer_address}
                  onChange={(event) => update('customer_address', event.target.value)}
                  autoComplete="street-address"
                  placeholder="House / flat, street, locality"
                />
              }
            />

            <Field
              label="Landmark"
              hint="Optional, but it makes a 10-minute delivery far more likely."
              input={
                <input
                  className="field"
                  value={details.customer_landmark}
                  onChange={(event) => update('customer_landmark', event.target.value)}
                  placeholder="Near Chanmari YMA hall"
                />
              }
            />

            <Field
              label="Note for the rider"
              input={
                <input
                  className="field"
                  value={details.delivery_notes}
                  onChange={(event) => update('delivery_notes', event.target.value)}
                  placeholder="Call on arrival, gate is locked"
                />
              }
            />

            <div className="card flex items-center gap-3 bg-[var(--color-surface-sunken)] p-3">
              <Wallet className="h-5 w-5 shrink-0 text-[var(--color-brand-700)]" aria-hidden />
              <div className="text-sm">
                <p className="font-semibold">Cash on delivery</p>
                <p className="text-xs text-[var(--color-ink-faint)]">
                  Online payment is not available yet.
                </p>
              </div>
            </div>

            {formError && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-[#fff1f2] px-3 py-2.5 text-sm font-semibold text-[#b91c1c]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {formError}
              </p>
            )}
          </div>

          <div className="mt-auto border-t border-[var(--color-line)] px-4 py-3">
            <div className="mb-2.5 flex items-center justify-between text-base font-extrabold">
              <span>To pay</span>
              <span className="tabular-nums">{formatMoneyExact(quote?.grand_total ?? 0)}</span>
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Placing order…
                </>
              ) : (
                'Place order'
              )}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  input,
}: {
  label: string;
  hint?: string;
  error?: string;
  input: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.8rem] font-bold text-[var(--color-ink-soft)]">
        {label}
      </span>
      {input}
      {error ? (
        <span className="mt-1 block text-xs font-semibold text-[#b91c1c]">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-[var(--color-ink-faint)]">{hint}</span>
      ) : null}
    </label>
  );
}
