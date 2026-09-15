/**
 * Run an async job over a list, a few at a time.
 *
 * Written for the orders page, which fans out one tracking request per
 * remembered order. `Promise.all` over that list opens up to ten simultaneous
 * connections to the API on every mount; the burst is what a rate limit is
 * for, and three at a time finishes at very nearly the same moment and looks
 * like a browser rather than like a script.
 *
 * Results come back in input order regardless of completion order, because the
 * caller is zipping them against the list it passed in.
 */
export async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  job: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  // One shared cursor rather than fixed slices: a slice per worker makes the
  // whole batch wait on whichever slice happened to contain the slow request.
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await job(items[index], index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker),
  );

  return results;
}

/**
 * A `.then` handler that does nothing once the effect that made the request
 * has been cleaned up.
 *
 * Aborting a controller rejects a request that is still in flight; it does
 * not stop one that has *already resolved* from running its `.then`. A query
 * typed over, or a page navigated away from, would otherwise write a stale
 * response into state — under the wrong heading, or after unmount. Every
 * fetch effect in the storefront wraps its success path in this.
 */
export function unlessAborted<T>(
  signal: AbortSignal,
  handler: (value: T) => void,
): (value: T) => void {
  return (value) => {
    if (signal.aborted) return;
    handler(value);
  };
}
