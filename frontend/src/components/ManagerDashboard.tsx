'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bike,
  Check,
  ChefHat,
  Clock,
  PackageCheck,
  RefreshCw,
  Timer,
  Warehouse,
  XCircle,
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { ApiError, authRequest } from '../lib/api';
import { formatDateTime, formatMoney, formatPhone } from '../lib/format';
import type { Order, OrderStatus, User } from '../types';
import ProductsDashboard from './ProductsDashboard';

type Tab = 'orders' | 'products';

type ManagerDashboardProps = {
  headerActions?: React.ReactNode;
};

/** Re-fetch even without a socket server, so the board is never badly stale. */
const REFRESH_MS = 15_000;

/**
 * The columns of the fulfilment board, in the order work flows through them.
 * `Ready` is where an order waits for a rider to pull it, which is why it is
 * the one column with a manual assign control.
 */
const COLUMNS: Array<{
  status: OrderStatus;
  label: string;
  icon: typeof Clock;
  tone: string;
}> = [
  { status: 'Placed', label: 'New', icon: Clock, tone: 'bg-amber-100 text-amber-800' },
  { status: 'Packing', label: 'Packing', icon: ChefHat, tone: 'bg-sky-100 text-sky-800' },
  { status: 'Ready', label: 'Ready', icon: PackageCheck, tone: 'bg-violet-100 text-violet-800' },
  { status: 'Dispatched', label: 'On the way', icon: Bike, tone: 'bg-indigo-100 text-indigo-800' },
];

/** What a manager can move an order to next. Mirrors Order.TRANSITIONS. */
const NEXT_STATUS: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  Placed: { to: 'Packing', label: 'Start packing' },
  Packing: { to: 'Ready', label: 'Mark ready' },
  Dispatched: { to: 'Delivered', label: 'Mark delivered' },
};

export default function ManagerDashboard({ headerActions }: ManagerDashboardProps) {
  const { socket } = useSocket();
  /**
   * Orders, tagged with the fetch that produced them. Tagging lets "is a
   * refresh in flight?" be *derived* instead of tracked in a flag that would
   * have to be set synchronously inside the effect.
   */
  const [loaded, setLoaded] = useState<{ key: string; orders: Order[] } | null>(null);
  const [riders, setRiders] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [error, setError] = useState('');
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [showStalledOnly, setShowStalledOnly] = useState(false);

  /**
   * Bumped to re-run the fetch below. Refreshing through a state change rather
   * than by calling a loader from inside an effect keeps every `setState` on an
   * async or event-handler path, which is what avoids a cascading render.
   */
  const [reloadToken, setReloadToken] = useState(0);
  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  const fetchKey = `${showStalledOnly}:${reloadToken}`;

  useEffect(() => {
    let cancelled = false;

    authRequest<Order[]>(
      showStalledOnly ? '/api/orders?stalled=true' : '/api/orders?open=true&limit=100',
    )
      .then((rows) => {
        if (cancelled) return;
        // A failed request used to be able to put `{"detail": ...}` into state
        // that is later `.map()`ed, which throws during render and blanks the
        // whole console including the logout button. Only ever store arrays.
        setLoaded({ key: fetchKey, orders: Array.isArray(rows) ? rows : [] });
        setError('');
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setLoaded((current) => ({ key: fetchKey, orders: current?.orders ?? [] }));
        setError(caught instanceof Error ? caught.message : 'Could not load orders.');
      });

    return () => {
      cancelled = true;
    };
  }, [fetchKey, showStalledOnly]);

  // Memoised so the fallback `[]` is not a fresh array on every render, which
  // would invalidate the `grouped` useMemo below every single time.
  const orders = useMemo(() => loaded?.orders ?? [], [loaded]);
  const isRefreshing = loaded?.key !== fetchKey;

  useEffect(() => {
    let cancelled = false;
    authRequest<User[]>('/api/delivery/riders')
      .then((rows) => {
        if (!cancelled) setRiders(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setRiders([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll regardless of the socket. There is no socket.io server in this repo,
  // so treating events as the only refresh path means a board that never
  // updates in the deployment everyone actually runs.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!socket) return;
    socket.on('order:created', refresh);
    socket.on('order:updated', refresh);
    return () => {
      socket.off('order:created', refresh);
      socket.off('order:updated', refresh);
    };
  }, [socket, refresh]);

  const availableRiders = useMemo(
    () => riders.filter((rider) => rider.role === 'delivery' && rider.is_active),
    [riders],
  );

  const act = async (orderId: number, run: () => Promise<unknown>) => {
    setBusyOrderId(orderId);
    setError('');
    try {
      await run();
      refresh();
    } catch (caught) {
      // A 409 here is normal, not exceptional: a rider accepted the order
      // between this page rendering and the manager clicking. Say so plainly
      // and refresh, rather than showing a scary failure.
      const message =
        caught instanceof ApiError && caught.isConflict
          ? `${caught.message} The board has been refreshed.`
          : caught instanceof Error
            ? caught.message
            : 'That action failed.';
      setError(message);
      refresh();
    } finally {
      setBusyOrderId(null);
    }
  };

  const changeStatus = (orderId: number, status: OrderStatus) =>
    act(orderId, () =>
      authRequest(`/api/orders/${orderId}/status`, { method: 'PATCH', body: { status } }),
    );

  const assignRider = (orderId: number, riderId: number) =>
    act(orderId, () =>
      authRequest(`/api/orders/${orderId}/assign`, {
        method: 'POST',
        body: { delivery_boy_id: riderId },
      }),
    );

  const grouped = useMemo(() => {
    const buckets = new Map<OrderStatus, Order[]>();
    for (const column of COLUMNS) buckets.set(column.status, []);
    for (const order of orders) {
      buckets.get(order.status)?.push(order);
    }
    return buckets;
  }, [orders]);

  const lateCount = orders.filter((order) => order.is_late).length;

  return (
    <div className="min-h-screen bg-[var(--color-surface-sunken)]">
      <header className="sticky top-0 z-10 border-b border-[var(--color-line)] bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-700)] text-white">
              <Warehouse className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight">eDawr Admin</h1>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
                Operations console
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap gap-1 rounded-xl border border-[var(--color-line)] p-1">
            {(['orders', 'products'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
                  activeTab === tab
                    ? 'bg-[var(--color-brand-700)] text-white'
                    : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunken)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>

          {headerActions ? <div className="ml-auto">{headerActions}</div> : null}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'products' ? (
          <ProductsDashboard />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold">Fulfilment board</h2>
                <p className="text-sm text-[var(--color-ink-faint)]">
                  {orders.length} open order{orders.length === 1 ? '' : 's'}
                  {lateCount > 0 && (
                    <span className="ml-2 font-semibold text-[#b91c1c]">
                      · {lateCount} past its promise
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={showStalledOnly}
                    onChange={(event) => setShowStalledOnly(event.target.checked)}
                    className="accent-[var(--color-brand-700)]"
                  />
                  Stalled only
                </label>
                <button
                  type="button"
                  onClick={refresh}
                  className="btn-ghost gap-2 py-2"
                  disabled={isRefreshing}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                    aria-hidden
                  />
                  Refresh
                </button>
              </div>
            </div>

            {showStalledOnly && (
              <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                Orders every available rider has declined, or that are past their promised
                time. Assign one manually to get them moving.
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-[#fff1f2] px-3 py-2.5 text-sm font-semibold text-[#b91c1c]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {error}
              </p>
            )}

            {orders.length === 0 ? (
              <div className="card px-6 py-14 text-center text-[var(--color-ink-faint)]">
                {showStalledOnly ? 'Nothing is stalled. ' : 'No open orders. '}
                Everything is under control.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-4">
                {COLUMNS.map((column) => {
                  const bucket = grouped.get(column.status) ?? [];
                  const Icon = column.icon;
                  return (
                    <section key={column.status} className="flex flex-col gap-2.5">
                      <h3 className="flex items-center gap-2 px-1 text-sm font-bold">
                        <Icon className="h-4 w-4" aria-hidden />
                        {column.label}
                        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs tabular-nums text-[var(--color-ink-faint)]">
                          {bucket.length}
                        </span>
                      </h3>

                      {bucket.length === 0 && (
                        <p className="rounded-xl border border-dashed border-[var(--color-line)] px-3 py-6 text-center text-xs text-[var(--color-ink-faint)]">
                          Empty
                        </p>
                      )}

                      {bucket.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          tone={column.tone}
                          riders={availableRiders}
                          busy={busyOrderId === order.id}
                          onAdvance={changeStatus}
                          onAssign={assignRider}
                        />
                      ))}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function OrderCard({
  order,
  tone,
  riders,
  busy,
  onAdvance,
  onAssign,
}: {
  order: Order;
  tone: string;
  riders: User[];
  busy: boolean;
  onAdvance: (orderId: number, status: OrderStatus) => void;
  onAssign: (orderId: number, riderId: number) => void;
}) {
  const next = NEXT_STATUS[order.status];

  return (
    <article className={`card p-3 ${order.is_late ? 'border-[#fca5a5]' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-[var(--color-ink-faint)]">
          #{order.id.toString().padStart(4, '0')}
        </span>
        <span className={`pill ${tone}`}>{order.status_label}</span>
      </div>

      <div
        className={`mt-1.5 flex items-center gap-1 text-xs font-bold ${
          order.is_late ? 'text-[#b91c1c]' : 'text-[var(--color-ink-soft)]'
        }`}
      >
        <Timer className="h-3.5 w-3.5" aria-hidden />
        {order.is_late ? 'Past promise' : `${order.minutes_remaining} min left`}
        <span className="ml-auto font-medium text-[var(--color-ink-faint)]">
          {formatDateTime(order.created_at)}
        </span>
      </div>

      <div className="mt-2 border-t border-[var(--color-line)] pt-2">
        <p className="text-sm font-semibold">{order.customer_name}</p>
        <p className="text-xs text-[var(--color-ink-faint)]">
          {formatPhone(order.customer_phone)}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-ink-soft)]">
          {order.customer_address}
        </p>
      </div>

      <ul className="mt-2 space-y-0.5 border-t border-[var(--color-line)] pt-2">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-2 text-xs">
            <span className="truncate text-[var(--color-ink-soft)]">
              {item.quantity}× {item.name}
            </span>
            <span className="shrink-0 tabular-nums text-[var(--color-ink-faint)]">
              {formatMoney(item.line_total)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex justify-between border-t border-[var(--color-line)] pt-2 text-sm font-bold">
        <span>Total</span>
        <span className="tabular-nums">{formatMoney(order.grand_total)}</span>
      </div>

      {order.rider && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-50)] px-2 py-1.5 text-xs font-semibold text-[var(--color-brand-700)]">
          <Bike className="h-3.5 w-3.5" aria-hidden />
          {order.rider.name}
        </p>
      )}

      <div className="mt-2.5 space-y-1.5">
        {next && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAdvance(order.id, next.to)}
            className="btn-primary w-full py-2 text-sm"
          >
            {next.to === 'Delivered' ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <PackageCheck className="h-4 w-4" aria-hidden />
            )}
            {next.label}
          </button>
        )}

        {order.status === 'Ready' && (
          <select
            className="field py-2 text-sm"
            defaultValue=""
            disabled={busy || riders.length === 0}
            onChange={(event) => {
              if (event.target.value) onAssign(order.id, Number(event.target.value));
            }}
          >
            <option value="" disabled>
              {riders.length === 0 ? 'No riders available' : 'Assign a rider…'}
            </option>
            {riders.map((rider) => (
              <option key={rider.id} value={rider.id}>
                {rider.name}
                {rider.is_available ? '' : ' (offline)'}
              </option>
            ))}
          </select>
        )}

        {order.status !== 'Dispatched' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAdvance(order.id, 'Cancelled')}
            className="btn-ghost w-full justify-center gap-1.5 py-1.5 text-xs text-[#b91c1c] hover:text-[#b91c1c]"
          >
            <XCircle className="h-3.5 w-3.5" aria-hidden />
            Cancel &amp; restock
          </button>
        )}
      </div>
    </article>
  );
}
