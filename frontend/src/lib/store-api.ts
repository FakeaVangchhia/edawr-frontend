import { request } from './api';
import type {
  BasketQuote,
  CartLine,
  DeliveryType,
  StoreCategory,
  StoreConfig,
  StoreProduct,
  TrackedOrder,
} from '@/types';

/**
 * The public storefront endpoints, typed.
 *
 * Every call here is anonymous — a customer has no account. The order endpoints
 * are keyed on an unguessable tracking token rather than an order id, which is
 * what lets them stay public without exposing every customer's address to
 * anyone who can count.
 */

export interface ProductQuery {
  q?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export function fetchStoreConfig(signal?: AbortSignal): Promise<StoreConfig> {
  return request<StoreConfig>('/api/store/config', { signal });
}

export function fetchCategories(signal?: AbortSignal): Promise<StoreCategory[]> {
  return request<StoreCategory[]>('/api/store/categories', { signal });
}

export function fetchProducts(
  query: ProductQuery = {},
  signal?: AbortSignal,
): Promise<StoreProduct[]> {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.category && query.category !== 'All') params.set('category', query.category);
  if (query.limit) params.set('limit', String(query.limit));
  if (query.offset) params.set('offset', String(query.offset));

  const suffix = params.toString();
  return request<StoreProduct[]>(
    `/api/store/products${suffix ? `?${suffix}` : ''}`,
    { signal },
  );
}

/** The wire format the checkout and quote endpoints expect. */
export function toBasketItems(lines: CartLine[]) {
  return lines.map((line) => ({
    product_id: line.product.id,
    quantity: line.quantity,
  }));
}

/**
 * Price a basket without placing it.
 *
 * The cart drawer calls this rather than adding up line totals in TypeScript,
 * so the figure a customer sees before paying is produced by the same code that
 * will charge them. A second implementation here would drift from the server's
 * the first time a fee changed, and the customer would notice at checkout.
 */
export function quoteBasket(
  lines: CartLine[],
  deliveryType: DeliveryType,
  signal?: AbortSignal,
): Promise<BasketQuote> {
  return request<BasketQuote>('/api/store/quote', {
    method: 'POST',
    body: { items: toBasketItems(lines), delivery_type: deliveryType },
    signal,
  });
}

export interface CheckoutDetails {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_landmark?: string;
  delivery_notes?: string;
}

/**
 * The tier is a third parameter rather than a `CheckoutDetails` field, and
 * deliberately not optional: TypeScript then makes every caller state which
 * speed it is buying. A tier that could be silently omitted is a customer
 * charged for a delivery they did not pick.
 */
export function placeOrder(
  lines: CartLine[],
  details: CheckoutDetails,
  deliveryType: DeliveryType,
): Promise<TrackedOrder> {
  return request<TrackedOrder>('/api/store/orders', {
    method: 'POST',
    body: { ...details, delivery_type: deliveryType, items: toBasketItems(lines) },
  });
}

export function trackOrder(token: string, signal?: AbortSignal): Promise<TrackedOrder> {
  return request<TrackedOrder>(`/api/store/orders/${encodeURIComponent(token)}`, { signal });
}

export function cancelOrder(token: string, reason: string): Promise<TrackedOrder> {
  return request<TrackedOrder>(`/api/store/orders/${encodeURIComponent(token)}/cancel`, {
    method: 'POST',
    body: { reason },
  });
}
