import { API_URL } from './config';
import { DeliveryDashboard, Order, OrderStatus, RiderSession, User } from './types';

/** Every backend error is `{"detail": "..."}` — see backend/api/exceptions.py. */
async function readError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null);
  return payload?.detail ?? `Request failed (${response.status}).`;
}

/** Thrown when the rider's token is missing, expired or rejected.
 *
 * Distinct from a generic failure so the UI can sign the rider out and show the
 * login screen instead of an alert they can only dismiss.
 */
export class UnauthorizedError extends Error {
  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Thrown when the request never reached the server.
 *
 * Riders lose signal constantly — stairwells, basements, the road out of
 * Aizawl. That is an expected condition, not a fault, and it must not look
 * like one: the UI shows a quiet "you are offline" banner for this rather than
 * the same red alert it shows for a real error.
 */
export class OfflineError extends Error {
  constructor() {
    super('No connection. The app will retry when you are back online.');
    this.name = 'OfflineError';
  }
}

/**
 * Thrown when the order has moved on without this rider — someone else took
 * it, or it was cancelled. Separated because it needs a refresh and a calm
 * explanation, not a retry.
 */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

/** Give up rather than leave a rider staring at a spinner on a dying signal. */
const TIMEOUT_MS = 15_000;

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  // React Native's fetch has no built-in timeout: on a flaky connection it can
  // hang indefinitely, and the rider has no way to tell that from a slow store.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        // The rider token, replayed the same way the web admin's authFetch does.
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    // fetch rejects on network failure and on abort; both mean "could not
    // reach the server", which is the same thing to a rider.
    throw new OfflineError();
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403) {
    throw new UnauthorizedError(await readError(response));
  }
  if (response.status === 409) {
    throw new ConflictError(await readError(response));
  }
  if (!response.ok) {
    throw new Error(await readError(response));
  }

  // 204 has no body; nothing in this app relies on the parsed value there.
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

// --------------------------------------------------------------------------
// Auth
// --------------------------------------------------------------------------
export function riderLogin(phone: string, pin: string): Promise<RiderSession> {
  return request('/api/auth/rider/login', {
    method: 'POST',
    body: { phone, pin },
  });
}

/** Revalidate a stored token on launch, and get a fresh one back. */
export function fetchRiderSession(token: string): Promise<RiderSession> {
  return request('/api/auth/rider/me', { token });
}

// --------------------------------------------------------------------------
// Delivery
// --------------------------------------------------------------------------
export function fetchDashboard(riderId: number, token: string): Promise<DeliveryDashboard> {
  return request(`/api/delivery/${riderId}/dashboard`, { token });
}

/**
 * The rider's own on/off switch. Distinct from `is_active`, which is the
 * manager's — going offline pauses new offers, it does not surrender the job.
 */
export function setAvailability(isAvailable: boolean, token: string): Promise<User> {
  return request('/api/delivery/availability', {
    method: 'PATCH',
    body: { is_available: isAvailable },
    token,
  });
}

// The rider is identified by the token, so none of these take a rider id — the
// backend ignores anything the body might claim. See backend/api/views/orders.py.
export function acceptOrder(orderId: number, token: string): Promise<Order> {
  return request(`/api/orders/${orderId}/accept`, { method: 'POST', token });
}

/**
 * Decline an order.
 *
 * This used to be decoration: it cleared a column nothing ever set, and the
 * order reappeared on the next refresh. The backend now records the decline,
 * and this rider stops being offered that order while everyone else still is.
 */
export function rejectOrder(orderId: number, token: string): Promise<{ success: boolean }> {
  return request(`/api/orders/${orderId}/reject`, { method: 'POST', token });
}

export function setOrderStatus(
  orderId: number,
  status: OrderStatus,
  token: string,
): Promise<Order> {
  return request(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status },
    token,
  });
}
