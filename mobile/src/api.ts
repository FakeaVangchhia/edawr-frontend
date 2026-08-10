import { API_URL } from './config';
import { DeliveryDashboard, Order, RiderSession } from './types';

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

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      // The rider token, replayed the same way the web admin's authFetch does.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 || response.status === 403) {
    throw new UnauthorizedError(await readError(response));
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

// The rider is identified by the token, so none of these take a rider id — the
// backend ignores anything the body might claim. See backend/api/views/orders.py.
export function acceptOrder(orderId: number, token: string): Promise<Order> {
  return request(`/api/orders/${orderId}/accept`, { method: 'POST', token });
}

export function rejectOrder(orderId: number, token: string): Promise<{ success: boolean }> {
  return request(`/api/orders/${orderId}/reject`, { method: 'POST', token });
}

export function setOrderStatus(
  orderId: number,
  status: Order['status'],
  token: string,
): Promise<Order> {
  return request(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status },
    token,
  });
}
