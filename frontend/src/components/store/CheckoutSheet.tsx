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
  const phoneRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);

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
      errors.customer_name = 'Please enter your name so the rider can ask for you.';
    }
    if (!isValidIndianMobile(details.customer_phone)) {
      errors.customer_phone = 'Please enter a 10-digit mobile number, like 98123 45678.';
    }
    if (details.customer_address.trim().length < 8) {
      errors.customer_address = 'Please add a full address the rider can find.';
    }

    setFieldErrors(errors);

    /**
     * Send focus to the first field that needs fixing.
     *
     * Without this, tapping "Place order" on a form whose only problem has
     * scrolled off the top does nothing you can see — the message is rendered
     * somewhere above the fold and the button just sits there. Focusing also
     * scrolls the field into view and makes a screen reader announce it, so
     * the same fix serves both.
     */
    const firstInvalid = errors.customer_name
      ? nameRef.current
      : errors.customer_phone
        ? phoneRef.current
        : errors.customer_address
          ? addressRef.current
          : null;
    firstInvalid?.focus();

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
        className="absolute inset-0 bg-[rgba(4,3,8,0.72)] backdrop-blur-[3px]"
      />

      <aside className="glass-strong relative flex h-full w-full max-w-md flex-col border-l border-[rgba(212,175,55,0.2)] shadow-2xl">
        <header className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-3.5">
          <button type="button" onClick={onClose} aria-label="Back to cart" className="btn-icon">
            <ArrowLeft className="h-6 w-6" aria-hidden />
          </button>
          <h2 className="text-xl font-extrabold">Where should we deliver?</h2>
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
                  ref={phoneRef}
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
                  ref={addressRef}
                  className={`field min-h-24 resize-y ${fieldErrors.customer_address ? 'field-invalid' : ''}`}
                  value={details.customer_address}
                  onChange={(event) => update('customer_address', event.target.value)}
                  autoComplete="street-address"
                  placeholder="House / flat, street, locality"
                />
              }
            />

            <Field
              label="Landmark"
              optional
              hint="A nearby shop or hall makes a 15-minute delivery far more likely."
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
              optional
              input={
                <input
                  className="field"
                  value={details.delivery_notes}
                  onChange={(event) => update('delivery_notes', event.target.value)}
                  placeholder="Call on arrival, gate is locked"
                />
              }
            />

            <div className="card flex items-center gap-3 bg-[var(--color-surface-sunken)] p-3.5">
              <Wallet className="h-6 w-6 shrink-0 text-[var(--color-brand-700)]" aria-hidden />
              <div>
                <p className="text-base font-semibold">Pay cash when it arrives</p>
                <p className="text-sm text-[var(--color-ink-faint)]">
                  Online payment is not available yet.
                </p>
              </div>
            </div>

            {formError && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-[var(--color-danger-50)] px-3 py-3 text-base font-semibold text-[var(--color-danger-600)]"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                {formError}
              </p>
            )}
          </div>

          <div className="mt-auto border-t border-[var(--color-line)] px-4 py-3.5">
            <div className="mb-3 flex items-center justify-between text-xl font-extrabold">
              <span>To pay</span>
              <span className="tabular-nums">{formatMoneyExact(quote?.grand_total ?? 0)}</span>
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  Placing order…
                </>
              ) : (
                'Place order'
              )}
            </button>
            <p className="mt-2 text-center text-sm text-[var(--color-ink-faint)]">
              No payment now — pay the rider in cash.
            </p>
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
  optional,
  input,
}: {
  label: string;
  hint?: string;
  error?: string;
  /** Marked in the label, not only in the hint — see below. */
  optional?: boolean;
  input: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2 text-base font-bold text-[var(--color-ink)]">
        {label}
        {/* Which fields are skippable is stated on the label itself. Three of
            these five are optional, and a form that looks like five required
            questions is a form people abandon — or worse, one they slow down
            over, on a store whose whole promise is fifteen minutes. */}
        {optional && (
          <span className="text-sm font-medium text-[var(--color-ink-faint)]">optional</span>
        )}
      </span>
      {input}
      {error ? (
        <span
          role="alert"
          className="mt-1.5 block text-sm font-semibold text-[var(--color-danger-600)]"
        >
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1.5 block text-sm text-[var(--color-ink-faint)]">{hint}</span>
      ) : null}
    </label>
  );
}
