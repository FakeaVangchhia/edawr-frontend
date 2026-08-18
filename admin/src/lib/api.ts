/**
 * The single fetch layer for the console.
 *
 * Ported from the storefront's `lib/api.ts`, which is well-shaped, plus the one
 * thing it is missing: **an interceptor that distinguishes 401 from 403.**
 *
 * In the storefront console those two are conflated (`isUnauthorized` returns
 * true for both) and the helper is never called at all, so a token that expires
 * mid-shift produces a red banner and a poll that keeps failing every fifteen
 * seconds forever. Here:
 *
 *   401 -> the server does not know who you are. Clear the session, go to
 *          /login. This is the *only* condition that ends a session.
 *   403 -> the server knows exactly who you are and this is not yours. Keep the
 *          session, surface the message. A Manager clicking an Admin-only link
 *          must be told no, not signed out.
 *
 * That distinction is a documented contract on the backend — `IsOwnerAdmin`
 * returns 403 deliberately, and the rider app's habit of treating them alike is
 * the bug that signs riders out mid-delivery. It is not repeated here.
 *
 * Equally important: the session is cleared *only* on a real 401. Never in a
 * bare `catch`. A network blip, a CORS misconfiguration or a CSP block all land
 * in the same catch as an auth failure, and deleting a perfectly valid token
 * because the wifi dropped is how the storefront's `/admin` page loses sessions.
 */

import { clearSession, readToken } from '@/lib/session';

const rawApiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim();

/** Trailing slashes stripped once, here, so no caller has to think about it. */
export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, '');

const isAbsoluteUrl = (value: string) => /^[a-z][a-z\d+\-.]*:\/\//i.test(value);

export const apiUrl = (path: string): string => {
  if (!path) return API_BASE_URL || '';
  if (isAbsoluteUrl(path)) return path;
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

/**
 * Product and category images are stored as relative paths ("/uploads/x.png")
 * so the hostname is never baked into the database. This puts it back.
 */
export const assetUrl = (path: string | null | undefined): string =>
  path ? apiUrl(path) : '';

/* -------------------------------------------------------------------------- */

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }

  /** The session is gone or was never valid. The only logout trigger. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /** Identified, and not permitted. Never a reason to log anybody out. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** A conflict with the state of the resource — an illegal status move, a
   *  product still referenced by an order, the last Admin being demoted. */
  get isConflict(): boolean {
    return this.status === 409;
  }

  /** Field-level errors from a DRF serializer, if the failure carried any. */
  get fieldErrors(): Record<string, string[]> | null {
    if (!this.payload || typeof this.payload !== 'object') return null;
    const entries = Object.entries(this.payload as Record<string, unknown>).filter(
      ([key, value]) => key !== 'detail' && Array.isArray(value),
    );
    if (!entries.length) return null;
    return Object.fromEntries(entries.map(([k, v]) => [k, (v as string[]).map(String)]));
  }
}

export class NetworkError extends Error {
  constructor(message = 'Could not reach the server.') {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Called when a request comes back 401. Set once by the console shell so the
 * redirect can use the Next router instead of a full page load.
 *
 * A module-level hook rather than a parameter on every call: the alternative is
 * threading a callback through every screen, and the one screen that forgets is
 * the one that leaves a dead session in place.
 */
type ExpiryHandler = () => void;
let onSessionExpired: ExpiryHandler | null = null;

export function setSessionExpiredHandler(handler: ExpiryHandler | null): void {
  onSessionExpired = handler;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers: headerInit, ...rest } = options;
  const headers = new Headers(headerInit);

  const isFormData = body instanceof FormData;
  // Setting a content type on FormData is actively harmful: the browser has to
  // append its own multipart boundary, and it will not if the header is set.
  if (body !== undefined && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...rest,
      headers,
      body:
        body === undefined
          ? undefined
          : isFormData
            ? body
            : JSON.stringify(body),
    });
  } catch (caught) {
    // Re-thrown rather than swallowed. A debounced search cancels its previous
    // request on every keystroke, and turning those aborts into "could not
    // reach the server" paints an error over a working screen.
    if (caught instanceof DOMException && caught.name === 'AbortError') throw caught;
    throw new NetworkError();
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = undefined;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail =
      (payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail: unknown }).detail)
        : '') || `Request failed (${response.status}).`;

    // The interceptor. Note the narrowness: 401 only.
    if (response.status === 401) {
      clearSession();
      onSessionExpired?.();
    }

    throw new ApiError(response.status, detail, payload);
  }

  return payload as T;
}

/** An unauthenticated request. Only `/api/auth/login` needs this. */
export function publicRequest<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(path, options);
}

/**
 * The authenticated request every screen uses.
 *
 * The token is read fresh from storage on each call rather than captured once,
 * so signing out in another tab takes effect on the very next request instead
 * of whenever this module happens to be re-evaluated.
 */
export function authRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = readToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return request<T>(path, { ...options, headers });
}

/**
 * A list request, returning the rows plus the unpaged total.
 *
 * The API's list responses are bare JSON arrays with no `{count, results}`
 * envelope — a deliberate choice that three clients depend on — so the total
 * arrives in `X-Total-Count`. That header has to be read off the raw response,
 * which is why this does not go through `request`.
 */
export async function authPage<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ rows: T[]; total: number }> {
  const token = readToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...options, headers, body: undefined });
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === 'AbortError') throw caught;
    throw new NetworkError();
  }

  const text = await response.text();
  let payload: unknown = undefined;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail =
      (payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail: unknown }).detail)
        : '') || `Request failed (${response.status}).`;
    if (response.status === 401) {
      clearSession();
      onSessionExpired?.();
    }
    throw new ApiError(response.status, detail, payload);
  }

  const rows = Array.isArray(payload) ? (payload as T[]) : [];
  const header = response.headers.get('X-Total-Count');
  // Falling back to the page length is right rather than lazy: a proxy that
  // strips the header should degrade to "one page" instead of showing a total
  // of zero next to a screen full of rows.
  const total = header !== null && header !== '' ? Number(header) : rows.length;

  return { rows, total: Number.isFinite(total) ? total : rows.length };
}

/** Build a query string, dropping empty values so URLs stay readable. */
export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const rendered = search.toString();
  return rendered ? `?${rendered}` : '';
}

/**
 * Turn any thrown value into one sentence for the user.
 *
 * Every screen needs this and none of them should each invent their own
 * phrasing for a network failure.
 */
export function errorMessage(caught: unknown): string {
  if (caught instanceof ApiError) return caught.message;
  if (caught instanceof NetworkError) return caught.message;
  if (caught instanceof Error && caught.message) return caught.message;
  return 'Something went wrong.';
}
