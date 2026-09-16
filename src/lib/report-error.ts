/**
 * Tell the backend that this app just broke.
 *
 * Until `POST /api/client-errors` existed there was nowhere to send this, and
 * the error boundary said so in its own docblock: no endpoint, and the CSP
 * would have blocked a third-party collector anyway. So the first anyone knew
 * about a broken deploy was a phone call from the shop.
 *
 * Three properties matter more than completeness here, because this runs at the
 * exact moment the app is already failing:
 *
 * **It cannot throw.** A reporter that raises inside an error boundary turns
 * one broken page into a boundary that cannot render, and React's fallback for
 * that is a blank screen. Every failure path here is swallowed.
 *
 * **It cannot block.** Fire and forget, with `keepalive` so the request
 * survives the navigation that a customer clicking "Go home" is about to cause.
 *
 * **It sends nothing it was not asked to.** The fields below are the allowlist
 * the server also enforces; in particular no cart contents, no address, no
 * phone number. An error report is not a place to discover you have shipped
 * customer data to a log.
 *
 * That last rule is why `route` is a route *pattern* and not
 * `location.pathname`. See `routePattern` below: one of these routes carries a
 * credential in its path, and a crash there used to put it in the log.
 */

import { apiUrl } from './api';

/**
 * Which build this is, if the deployment says.
 *
 * A crash line that cannot name a build cannot be triaged: "is this the deploy
 * we shipped an hour ago, or has it been broken all week?" is the first
 * question asked and the log could not answer it. The server has allowlisted
 * `release` since the endpoint existed; nothing was ever sending it.
 *
 * Read as a literal `process.env.NEXT_PUBLIC_*` reference because that is what
 * Next inlines at build time — the value is baked into the bundle, so it
 * describes the build the browser is running rather than whatever the server
 * happens to be now. `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` is Vercel's own,
 * exposed automatically; the explicit variable wins so a different host can set
 * one. Unset is a supported outcome: the field is simply omitted, which is
 * exactly today's behaviour.
 */
const RELEASE = (
  process.env.NEXT_PUBLIC_RELEASE ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  ''
).slice(0, 64);

/**
 * The path, with anything secret in it taken out.
 *
 * `/order/<token>` is the tracking page, and that token is not an id — it is the
 * whole credential. It authenticates the tracking page, which shows the
 * customer's name, phone, address and total, and `POST /api/customer/orders/claim`
 * accepts it as proof of possession and attaches the order to an account. A
 * crash on that page sent `location.pathname` verbatim, so the token landed in
 * a production log line: JSON, shipped to the host's log search, readable by
 * anyone with a dashboard login and retained on the host's schedule, not ours.
 *
 * The pattern is also the more useful value. `route` exists to say *which
 * screen* broke, and `/order/[token]` groups every tracking-page crash into one
 * line of a dashboard where the raw paths were all distinct.
 *
 * Only the credential-bearing route is rewritten. `/product/42` and
 * `/category/rice` are public catalogue paths and are worth keeping verbatim.
 * `api/views/reports.py` redacts server-side as well, because a CSP report's
 * `document-uri` is composed by the browser and no code here gets a say.
 */
export function routePattern(pathname: string): string {
  return pathname.replace(/^\/order\/[^/]+.*$/, '/order/[token]');
}

/**
 * Caps every string before it goes on the wire.
 *
 * The obvious reason is that the server truncates anyway — `MAX_FIELD` and
 * `MAX_STACK` in `api/views/reports.py` — so everything past those caps is
 * bandwidth spent to be discarded on arrival, which on Aizawl mobile data is
 * not free.
 *
 * The one that actually bites is quieter. A `keepalive` request draws on a
 * **64 KB quota shared across the origin**, and over it the browser rejects the
 * fetch outright. An unusually large stack would therefore lose the whole
 * report, silently, at the moment it is most wanted — the failure mode this
 * module exists to prevent, arriving through the flag that exists to prevent it.
 */
const MAX_FIELD = 2000;
const MAX_STACK = 8000;

function cap(value: string | undefined, limit: number): string | undefined {
  return value === undefined ? undefined : value.slice(0, limit);
}

export interface ClientErrorReport {
  /** Which app. The server keeps storefront and console crashes apart. */
  client: 'storefront' | 'console';
  /** A route *pattern*, never a raw path — see `routePattern`. */
  route?: string;
  message?: string;
  /**
   * Next.js gives a client boundary a `digest` and withholds the message for an
   * error thrown during server rendering — deliberately, so a stack trace never
   * reaches a browser. The digest is the only thing that ties this report to
   * the full traceback already sitting in the server log.
   */
  digest?: string;
  stack?: string;
}

export function reportClientError(report: ClientErrorReport): void {
  if (typeof window === 'undefined') return;

  try {
    void fetch(apiUrl('/api/client-errors'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // The page is very likely about to unload — the customer is reading a
      // "try again" button. Without this the browser cancels the request on
      // navigation and the report is lost precisely when it is most wanted.
      keepalive: true,
      body: JSON.stringify({
        route: routePattern(window.location?.pathname ?? ''),
        ...(RELEASE ? { release: RELEASE } : {}),
        ...report,
        // Capped after the spread, so a caller cannot get past it by passing a
        // longer one. `undefined` is dropped by JSON.stringify, so an absent
        // field stays absent rather than becoming null.
        message: cap(report.message, MAX_FIELD),
        stack: cap(report.stack, MAX_STACK),
      }),
      // Deliberately not `request()` from lib/api: that retries, throws typed
      // errors and has a timeout, all of which are the wrong behaviour for a
      // best-effort report sent from inside a failure.
    }).catch(() => {
      // The store is unreachable. That is very often *why* we are here.
    });
  } catch {
    // `fetch` itself can throw synchronously on a malformed URL — which is one
    // of the failure modes this exists to report, so it must not become one.
  }
}
