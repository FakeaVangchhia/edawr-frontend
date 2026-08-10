'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

/**
 * The last line of defence for a render that threw.
 *
 * Without this file, an uncaught error in any client component blanks the whole
 * page — the customer sees white, with no way back and nothing to report. This
 * turns that into something they can act on.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The place to wire up Sentry or similar. `digest` is the server-side id
    // Next.js assigns, which is what ties this screen to a stack trace in the
    // logs — the message itself is deliberately scrubbed in production builds.
    console.error('Unhandled error', error.digest ?? '', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-sunken)] px-4">
      <div className="card flex max-w-sm flex-col items-center gap-3 p-8 text-center">
        <AlertTriangle className="h-9 w-9 text-[#b91c1c]" aria-hidden />
        <h1 className="text-lg font-extrabold">Something went wrong</h1>
        <p className="text-sm text-[var(--color-ink-soft)]">
          The store hit an unexpected problem. Your cart is safe.
        </p>
        {error.digest && (
          <p className="text-xs text-[var(--color-ink-faint)]">Reference: {error.digest}</p>
        )}
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href="/" className="btn-ghost">
            Back to store
          </Link>
        </div>
      </div>
    </div>
  );
}
