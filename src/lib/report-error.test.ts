import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { reportClientError, routePattern } from '@/lib/report-error';

/**
 * What a crash report is allowed to say about where it happened.
 *
 * `route` used to be `location.pathname` verbatim, which is fine on fourteen of
 * the fifteen routes and a credential leak on the fifteenth: the token in
 * `/order/<token>` is the entire authentication for the tracking page — name,
 * phone, address, items, total — and `POST /api/customer/orders/claim` accepts
 * it as proof of possession and attaches that order to an account. A production
 * log is JSON shipped to the host's log search, retained on their schedule and
 * readable by anyone with a dashboard login, so a token in a log line is a
 * credential handed to a wider audience than the customer it was issued to.
 *
 * The server redacts as well (`api/views/reports.py`), because a CSP report's
 * `document-uri` is composed by the browser. This is the half that means the
 * secret never leaves the device in the first place.
 */
describe('routePattern', () => {
  const token = 'kVn3sXQ7pR2mW9tL5yB8cD1f';

  it('replaces a tracking token with the route pattern', () => {
    expect(routePattern(`/order/${token}`)).toBe('/order/[token]');
  });

  it('leaves nothing of the token behind, whatever follows it', () => {
    for (const path of [`/order/${token}/`, `/order/${token}/receipt`]) {
      expect(routePattern(path)).not.toContain(token);
    }
  });

  it('keeps the public catalogue paths verbatim', () => {
    // The field exists to say which screen broke. A rule that blanked these
    // would trade a leak for a log nobody can act on — and a product id and a
    // category slug are the catalogue, which is public by definition.
    expect(routePattern('/product/42')).toBe('/product/42');
    expect(routePattern('/category/rice-and-grains')).toBe('/category/rice-and-grains');
    expect(routePattern('/orders')).toBe('/orders');
    expect(routePattern('/')).toBe('/');
  });

  it('does not mistake a path that merely starts with the same letters', () => {
    expect(routePattern('/orders/history')).toBe('/orders/history');
  });
});


/**
 * The property the whole module is built around, finally asserted.
 *
 * `reportClientError` runs inside an error boundary. A reporter that raises
 * there turns one broken page into a boundary that cannot render, and React's
 * fallback for *that* is a blank screen — so a bug here converts a recoverable
 * failure into a total one. Every branch below is a real failure mode: a
 * malformed URL makes `fetch` throw synchronously before it returns a promise,
 * and an unreachable store makes it reject, which is very often *why* we are
 * reporting at all.
 */
describe('reportClientError', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  const report = { client: 'storefront' as const, message: 'boom', stack: 'at Home' };

  it('does not throw when fetch throws synchronously', () => {
    fetchMock.mockImplementation(() => {
      throw new TypeError('Failed to parse URL');
    });

    expect(() => reportClientError(report)).not.toThrow();
  });

  it('does not throw, or reject, when the request fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('NetworkError when attempting to fetch'));

    expect(() => reportClientError(report)).not.toThrow();
    // Settle the rejection inside the test, so an unhandled one would surface
    // here rather than as a process-level warning nobody reads.
    await Promise.resolve();
  });

  it('returns nothing and awaits nothing', () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    expect(reportClientError(report)).toBeUndefined();
  });

  it('caps the fields before they go on the wire', () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    reportClientError({
      client: 'storefront',
      message: 'm'.repeat(5_000),
      stack: 's'.repeat(20_000),
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    // The server truncates to exactly these, so anything longer is bandwidth
    // spent to be discarded — and past 64 KB a `keepalive` request is dropped
    // by the browser entirely, losing the report.
    expect(body.message).toHaveLength(2_000);
    expect(body.stack).toHaveLength(8_000);
  });

  it('sends a stack-free report without inventing empty fields', () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    reportClientError({ client: 'storefront', digest: 'abc123' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).not.toHaveProperty('stack');
    expect(body).not.toHaveProperty('message');
    expect(body.digest).toBe('abc123');
  });
});
