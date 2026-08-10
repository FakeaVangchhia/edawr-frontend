import { getAdminAccessToken } from './auth';

/**
 * The single place the backend URL appears.
 *
 * Everything that talks to Django goes through `apiUrl()` (public) or
 * `authFetch()` (attaches the admin bearer token), so repointing the app at a
 * different backend is a one-variable change. Never hardcode a host in a
 * component.
 */
const rawApiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim();

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, '');

const isAbsoluteUrl = (value: string) => /^[a-z][a-z\d+\-.]*:\/\//i.test(value);

export const apiUrl = (path: string) => {
  if (!path) return API_BASE_URL || '';
  if (isAbsoluteUrl(path)) return path;
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

/**
 * Product and category images are stored as relative paths ("/uploads/x.png")
 * so the hostname is never baked into the database. This puts it back.
 */
export const assetUrl = (path: string | null | undefined) => (path ? apiUrl(path) : '');

/**
 * A failed API call, carrying enough to render something useful.
 *
 * `payload` matters for checkout: a 409 comes back with an `unavailable` array
 * naming the items that ran out, and the cart uses it to mark exactly those
 * rows rather than showing a generic "something went wrong".
 */
export class ApiError extends Error {
  readonly status: number;
  readonly payload: Record<string, unknown>;

  constructor(message: string, status: number, payload: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }

  /** True when the caller's credentials are missing, expired or rejected. */
  get isUnauthorized() {
    return this.status === 401 || this.status === 403;
  }

  /** True when the request was fine but the world changed underneath it. */
  get isConflict() {
    return this.status === 409;
  }
}

/** Thrown when the request never reached the server at all. */
export class NetworkError extends Error {
  constructor() {
    super('Could not reach the store. Check your connection and try again.');
    this.name = 'NetworkError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

/**
 * One fetch wrapper for the whole app.
 *
 * Every error the backend can produce is `{"detail": "..."}` (enforced by
 * `api/exceptions.py`), so this reads that one field and throws an `ApiError`.
 * The alternative — checking `response.ok` at forty call sites — is how a
 * failed request ends up rendering as an empty list with no explanation.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const requestHeaders = new Headers(headers);

  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...rest,
      headers: requestHeaders,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
  } catch {
    // fetch() rejects only on a network-level failure; an HTTP 500 resolves.
    throw new NetworkError();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      (payload && typeof payload.detail === 'string' && payload.detail) ||
      `Request failed (${response.status}).`;
    throw new ApiError(detail, response.status, payload ?? {});
  }

  return payload as T;
}

/** `request`, with the admin bearer token attached. */
export async function authRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getAdminAccessToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return request<T>(path, { ...options, headers });
}

/**
 * The raw-Response version, kept because the admin components read
 * `response.ok` directly. New code should prefer `authRequest`.
 */
export const authFetch = (path: string, init: RequestInit = {}) => {
  const token = getAdminAccessToken();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(apiUrl(path), { ...init, headers });
};
