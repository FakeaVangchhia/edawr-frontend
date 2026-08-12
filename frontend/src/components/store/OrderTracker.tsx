'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bike,
  Check,
  ChefHat,
  Loader2,
  PackageCheck,
  Phone,
  Receipt,
  Timer,
  XCircle,
} from 'lucide-react';
import { ApiError } from '@/lib/api';
import {
  formatClockTime,
  formatCountdown,
  formatMoney,
  formatMoneyExact,
  formatPhone,
} from '@/lib/format';
import { cancelOrder, trackOrder } from '@/lib/store-api';
import { forgetOrder } from '@/lib/recent-orders';
import type { OrderStatus, TrackedOrder } from '@/types';

/** How often to re-check a live order. */
const POLL_MS = 10_000;

const TERMINAL: OrderStatus[] = ['Delivered', 'Cancelled'];

const STEPS: Array<{ status: OrderStatus; label: string; icon: typeof Check }> = [
  { status: 'Placed', label: 'Order placed', icon: Receipt },
  { status: 'Packing', label: 'Packing your order', icon: ChefHat },
  { status: 'Ready', label: 'Ready for pickup', icon: PackageCheck },
  { status: 'Dispatched', label: 'Out for delivery', icon: Bike },
  { status: 'Delivered', label: 'Delivered', icon: Check },
];

export default function OrderTracker({ token }: { token: string }) {
  const [state, setState] = useState<{ order: TrackedOrder | null; error: string } | null>(
    null,
  );
  const [isCancelling, setIsCancelling] = useState(false);
  /**
   * Bumped to re-run the fetch. Refreshing via a state change rather than by
   * calling a fetch function from inside the effect keeps every `setState` on
   * an async or event-handler path, which is what avoids a cascading render.
   */
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    trackOrder(token, controller.signal)
      .then((order) => setState({ order, error: '' }))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        if (caught instanceof ApiError && caught.status === 404) {
          // A token that 404s is one this browser should stop advertising —
          // most likely the database was reseeded.
          forgetOrder(token);
          setState((current) => ({
            order: current?.order ?? null,
            error: 'We could not find that order. Check the link and try again.',
          }));
          return;
        }
        setState((current) => ({
          order: current?.order ?? null,
          error: caught instanceof Error ? caught.message : 'Could not load that order.',
        }));
      });

    return () => controller.abort();
  }, [token, reloadToken]);

  const order = state?.order ?? null;
  const error = state?.error ?? '';
  const isLoading = state === null;

  // Poll while the order is live. Stops on a terminal status, and pauses while
  // the tab is hidden — a phone in a pocket does not need to ask every ten
  // seconds, and the endpoint is rate limited per IP.
  const isLive = order !== null && !TERMINAL.includes(order.status);

  useEffect(() => {
    if (!isLive) return;

    const refresh = () => {
      if (document.visibilityState === 'visible') setReloadToken((value) => value + 1);
    };

    const timer = window.setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [isLive]);

  const cancel = async () => {
    if (!order) return;
    setIsCancelling(true);
    try {
      const updated = await cancelOrder(token, 'Cancelled by customer');
      setState({ order: updated, error: '' });
    } catch (caught) {
      setState((current) => ({
        order: current?.order ?? null,
        error: caught instanceof Error ? caught.message : 'Could not cancel the order.',
      }));
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <Shell>
        <div className="card flex items-center justify-center gap-2 p-10 text-[var(--color-ink-soft)]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading your order…
        </div>
      </Shell>
    );
  }

  if (error && !order) {
    return (
      <Shell>
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <AlertTriangle className="h-9 w-9 text-[var(--color-danger-600)]" aria-hidden />
          <p className="font-semibold">{error}</p>
          <Link href="/" className="btn-primary mt-1">
            Back to store
          </Link>
        </div>
      </Shell>
    );
  }

  if (!order) return null;

  const isCancelled = order.status === 'Cancelled';
  const isDelivered = order.status === 'Delivered';
  const currentStep = STEPS.findIndex((step) => step.status === order.status);

  return (
    <Shell>
      {/* --- the promise, or how it ended --------------------------------- */}
      <section
        className={`rounded-2xl p-5 text-[var(--color-ink)] ${isCancelled ? 'bg-[#3a1417] border border-[rgba(252,165,165,0.25)]' : 'brand-gradient border border-[rgba(212,175,55,0.22)]'}`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-faint)]">
          Order #{order.id}
        </p>

        {isCancelled ? (
          <>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-black">
              <XCircle className="h-6 w-6" aria-hidden />
              Order cancelled
            </h1>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {order.cancellation_reason || 'This order was cancelled.'}
            </p>
          </>
        ) : isDelivered ? (
          <>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-black">
              <Check className="h-6 w-6" aria-hidden />
              Delivered
            </h1>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Delivered at {formatClockTime(order.delivered_at)}. Thanks for shopping with us.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-black">
              <Timer className="h-6 w-6 text-[var(--color-brand-500)]" aria-hidden />
              {order.is_late
                ? 'Arriving shortly'
                : `Arriving in ${formatCountdown(order.minutes_remaining)}`}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {order.is_late
                ? 'Running a little behind — your order is on its way.'
                : `Promised within ${order.promised_minutes} minutes of ordering.`}
            </p>
          </>
        )}
      </section>

      {/* --- progress ------------------------------------------------------ */}
      {!isCancelled && (
        <section className="card p-4">
          <ol className="space-y-0">
            {STEPS.map((step, index) => {
              const isDone = currentStep > index;
              const isCurrent = currentStep === index;
              const stamp = timestampFor(order, step.status);
              const Icon = step.icon;

              return (
                <li key={step.status} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                        isDone || isCurrent
                          ? 'border-[var(--color-brand-500)] bg-gradient-to-br from-[#f4dc93] to-[#d4af37] text-[#12100a]'
                          : 'border-[var(--color-line)] bg-[rgba(8,7,12,0.6)] text-[var(--color-ink-faint)]'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    {index < STEPS.length - 1 && (
                      <span
                        className={`w-0.5 flex-1 ${
                          isDone ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--color-line)]'
                        }`}
                        style={{ minHeight: '1.5rem' }}
                      />
                    )}
                  </div>

                  <div className={`pb-5 ${index === STEPS.length - 1 ? 'pb-0' : ''}`}>
                    <p
                      className={`text-sm font-bold ${
                        isDone || isCurrent
                          ? 'text-[var(--color-ink)]'
                          : 'text-[var(--color-ink-faint)]'
                      }`}
                    >
                      {step.label}
                    </p>
                    {stamp && (
                      <p className="text-xs text-[var(--color-ink-faint)]">
                        {formatClockTime(stamp)}
                      </p>
                    )}
                    {isCurrent && !isDelivered && (
                      <p className="mt-0.5 text-xs font-semibold text-[var(--color-brand-700)]">
                        In progress
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* --- rider --------------------------------------------------------- */}
      {order.rider && (
        <section className="card flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
            <Bike className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{order.rider.name}</p>
            <p className="text-xs text-[var(--color-ink-faint)]">Your delivery partner</p>
          </div>
          <a
            href={`tel:${order.rider.phone}`}
            className="btn-ghost gap-1.5 px-3 py-2 text-sm"
            aria-label={`Call ${order.rider.name}`}
          >
            <Phone className="h-4 w-4" aria-hidden />
            Call
          </a>
        </section>
      )}

      {/* --- address ------------------------------------------------------- */}
      <section className="card p-4">
        <h2 className="text-sm font-bold">Delivering to</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{order.customer_name}</p>
        <p className="text-sm text-[var(--color-ink-soft)]">{order.customer_address}</p>
        {order.customer_landmark && (
          <p className="text-sm text-[var(--color-ink-faint)]">Near {order.customer_landmark}</p>
        )}
        <p className="mt-1 text-sm text-[var(--color-ink-faint)]">
          {formatPhone(order.customer_phone)}
        </p>
      </section>

      {/* --- bill ---------------------------------------------------------- */}
      <section className="card p-4">
        <h2 className="mb-2 text-sm font-bold">
          {order.items.length} item{order.items.length === 1 ? '' : 's'}
        </h2>

        <ul className="divide-y divide-[var(--color-line)]">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-[var(--color-ink-faint)]">
                  {item.quantity} × {formatMoney(item.price)}
                  {item.unit ? ` · ${item.unit}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatMoney(item.line_total)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-1 border-t border-dashed border-[var(--color-line)] pt-3 text-sm text-[var(--color-ink-soft)]">
          <Row label="Item total" value={formatMoney(order.items_total)} />
          <Row
            label="Delivery"
            value={order.delivery_fee === 0 ? 'FREE' : formatMoney(order.delivery_fee)}
          />
          <Row label="Handling" value={formatMoney(order.handling_fee)} />
          <div className="flex items-center justify-between pt-1.5 text-base font-extrabold text-[var(--color-ink)]">
            <span>{isDelivered ? 'Paid' : 'To pay'}</span>
            <span className="tabular-nums">{formatMoneyExact(order.grand_total)}</span>
          </div>
          <p className="pt-0.5 text-xs text-[var(--color-ink-faint)]">Cash on delivery</p>
        </div>
      </section>

      {error && order && (
        <p role="alert" className="rounded-lg bg-[var(--color-danger-50)] px-3 py-2.5 text-sm font-semibold text-[var(--color-danger-600)]">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/" className="btn-ghost flex-1 justify-center">
          Back to store
        </Link>
        {order.can_cancel && (
          <button
            type="button"
            onClick={cancel}
            disabled={isCancelling}
            className="btn-ghost flex-1 justify-center border-[rgba(252,165,165,0.4)] text-[var(--color-danger-600)] hover:border-[rgba(252,165,165,0.7)] hover:text-[var(--color-danger-600)]"
          >
            {isCancelling ? 'Cancelling…' : 'Cancel order'}
          </button>
        )}
      </div>

      {!order.can_cancel && !isDelivered && !isCancelled && (
        <p className="text-center text-xs text-[var(--color-ink-faint)]">
          Your order is already with the rider. Call them if something needs to change.
        </p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-surface-sunken)] px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-3">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function timestampFor(order: TrackedOrder, status: OrderStatus): string | null {
  switch (status) {
    case 'Placed':
      return order.created_at;
    case 'Ready':
      return order.packed_at;
    case 'Dispatched':
      return order.dispatched_at;
    case 'Delivered':
      return order.delivered_at;
    default:
      return null;
  }
}
