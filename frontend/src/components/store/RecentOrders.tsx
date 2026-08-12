'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PackageCheck, RotateCcw } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { formatMoney } from '@/lib/format';
import {
  getRecentOrdersServerSnapshot,
  getRecentOrdersSnapshot,
  subscribeToRecentOrders,
} from '@/lib/recent-orders';
import { buildReorder } from '@/lib/reorder';

/**
 * "Order again" for the last order placed on this device.
 *
 * This is the fastest path to a full basket that exists in the app, and it was
 * previously unreachable: the tracking tokens were being written to localStorage
 * at checkout and never read back, so a customer who closed the tab had lost
 * both the order and any way to repeat it.
 *
 * Only the most recent order is shown. A list of ten would be a second
 * navigation problem on top of the catalogue; the common case is "the same as
 * last time", and the tracking page already links the rest.
 */
export default function RecentOrders() {
  const router = useRouter();
  const { mergeLines } = useCart();
  const orders = useSyncExternalStore(
    subscribeToRecentOrders,
    getRecentOrdersSnapshot,
    getRecentOrdersServerSnapshot,
  );

  const [isBusy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const latest = orders[0];
  if (!latest) return null;

  const orderAgain = async () => {
    setBusy(true);
    setNote('');
    try {
      const { lines, skipped } = await buildReorder(latest.token);

      if (lines.length === 0) {
        setNote(
          skipped.length > 0
            ? 'Nothing from that order is available right now.'
            : 'That order could not be loaded.',
        );
        return;
      }

      mergeLines(lines);

      // Say what was left out, by name. Silently adding eleven of twelve items
      // is how someone discovers at the door that the one thing they actually
      // needed is missing.
      setNote(
        skipped.length === 0
          ? `Added ${lines.length} item${lines.length === 1 ? '' : 's'} to your cart.`
          : `Added ${lines.length} of ${lines.length + skipped.length}. Not available: ${skipped
              .map((item) => item.name)
              .join(', ')}.`,
      );
    } catch {
      setNote('Could not load that order. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Your last order"
      className="card mb-4 flex flex-wrap items-center gap-3 p-3.5"
    >
      <PackageCheck
        className="h-7 w-7 shrink-0 text-[var(--color-brand-700)]"
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <p className="text-base font-bold">Your last order</p>
        <p className="text-sm text-[var(--color-ink-faint)]">
          {latest.itemCount} item{latest.itemCount === 1 ? '' : 's'} ·{' '}
          {formatMoney(latest.total)}
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => router.push(`/order/${latest.token}`)}
          className="btn-ghost"
        >
          Track
        </button>
        <button type="button" onClick={orderAgain} disabled={isBusy} className="btn-add w-auto px-4">
          {isBusy ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Adding…
            </>
          ) : (
            <>
              <RotateCcw className="h-5 w-5" aria-hidden />
              Order again
            </>
          )}
        </button>
      </div>

      {/* aria-live so the outcome is announced rather than only shown — the
          button that triggered it may already have scrolled away. */}
      {note && (
        <p
          aria-live="polite"
          className="w-full text-sm font-semibold text-[var(--color-ink-soft)]"
        >
          {note}
        </p>
      )}
    </section>
  );
}
