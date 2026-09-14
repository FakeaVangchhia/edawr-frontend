import { describe, expect, it } from 'vitest';
import {
  INDEXABLE_PATHS,
  PRIVATE_PATHS,
  breadcrumbJsonLd,
  clockTime,
  jsonLdString,
  productJsonLd,
  storeJsonLd,
} from './seo';
import type { StoreConfig, StoreProduct } from '@/types';

/**
 * The structured data is read by a machine that never complains — a wrong
 * block is silently ignored rather than flagged — so these pin the parts that
 * would make Google drop it: real hours only when the API gave them, a price
 * that is the product's own, and JSON that cannot break out of its tag.
 */

const PRODUCT: StoreProduct = {
  id: 7,
  name: 'Parle-G Biscuits',
  category: 'Snacks & Munchies',
  brand: 'Parle',
  unit: '250 g',
  price: 25,
  mrp: 30,
  description: 'Glucose biscuits </script><b>x',
  image_url: '/uploads/parle.png',
  in_stock: true,
  low_stock: false,
  discount_percent: 16,
};

function config(overrides: Partial<StoreConfig> = {}): StoreConfig {
  return {
    store_name: 'eDawr',
    store_city: 'Aizawl',
    delivery_tiers: [],
    free_delivery_above: 199,
    handling_fee: 5,
    min_order_value: 49,
    promise_minutes: 15,
    delivery_fee: 15,
    is_open: true,
    closed_reason: '',
    opens_at: '07:00:00',
    closes_at: '22:00:00',
    delivery_radius_km: 8,
    store_latitude: 23.7271,
    store_longitude: 92.7176,
    ...overrides,
  } as StoreConfig;
}

describe('clockTime', () => {
  it('trims the seconds and rejects anything else', () => {
    expect(clockTime('07:00:00')).toBe('07:00');
    expect(clockTime('22:30')).toBe('22:30');
    expect(clockTime('')).toBeNull();
    expect(clockTime(undefined)).toBeNull();
    expect(clockTime('seven')).toBeNull();
  });
});

describe('storeJsonLd', () => {
  it('describes the shop as a grocery store in Aizawl with its real hours', () => {
    const graph = storeJsonLd(config())['@graph'] as Array<Record<string, unknown>>;
    const store = graph.find((node) => node['@type'] === 'GroceryStore')!;
    expect(store.name).toBe('eDawr');
    expect((store.address as { addressLocality: string }).addressLocality).toBe('Aizawl');
    expect(store.geo).toEqual({ '@type': 'GeoCoordinates', latitude: 23.7271, longitude: 92.7176 });
    const hours = (store.openingHoursSpecification as Array<Record<string, unknown>>)[0];
    expect(hours.opens).toBe('07:00');
    expect(hours.closes).toBe('22:00');
  });

  it('omits hours and coordinates rather than inventing them', () => {
    const graph = storeJsonLd(null)['@graph'] as Array<Record<string, unknown>>;
    const store = graph.find((node) => node['@type'] === 'GroceryStore')!;
    expect(store).not.toHaveProperty('openingHoursSpecification');
    expect(store).not.toHaveProperty('geo');
    expect(store.name).toBe('eDawr');
  });
});

describe('productJsonLd', () => {
  it('carries the product price and availability, not a computed one', () => {
    const ld = productJsonLd(PRODUCT);
    const offer = ld.offers as Record<string, unknown>;
    expect(offer.price).toBe(25);
    expect(offer.priceCurrency).toBe('INR');
    expect(offer.availability).toBe('https://schema.org/InStock');
    expect(productJsonLd({ ...PRODUCT, in_stock: false }).offers).toMatchObject({
      availability: 'https://schema.org/OutOfStock',
    });
    expect(ld.url).toMatch(/\/product\/7$/);
    expect(String(ld.image)).toMatch(/^https?:\/\//);
  });
});

describe('breadcrumbJsonLd', () => {
  it('numbers the trail from one', () => {
    const items = breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Snacks', path: '/category/snacks' },
    ]).itemListElement as Array<Record<string, unknown>>;
    expect(items.map((item) => item.position)).toEqual([1, 2]);
    expect(items[1].item).toMatch(/\/category\/snacks$/);
  });
});

describe('jsonLdString', () => {
  it('cannot close the script tag it is placed in', () => {
    const out = jsonLdString(productJsonLd(PRODUCT));
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c/script>');
    expect(JSON.parse(out).description).toBe(PRODUCT.description);
  });
});

describe('crawl lists', () => {
  it('never marks a private page as indexable', () => {
    for (const path of PRIVATE_PATHS) {
      expect(INDEXABLE_PATHS as readonly string[]).not.toContain(path.replace(/\/$/, ''));
    }
  });
});
