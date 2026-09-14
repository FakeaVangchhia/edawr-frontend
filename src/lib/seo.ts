import { assetUrl } from './api';
import { slugify } from './catalogue';
import type { StoreConfig, StoreProduct } from '@/types';

/**
 * What a search engine is told about this shop.
 *
 * Everything here is the *server's* view: `robots.ts`, `sitemap.ts` and the
 * page wrappers run on the server, so a crawler that never executes
 * JavaScript still gets the title, the canonical URL and the structured data.
 * That matters because the storefront is a client-rendered catalogue — with no
 * sitemap and no JSON-LD, Google sees a shell with one <h1> and no products.
 *
 * The one rule: nothing in this file invents a fact. The store's name, city,
 * hours and coordinates come from `/api/store/config`; a product's price and
 * stock come from the product. A `LocalBusiness` block with hours typed into
 * the source is the kind that reads "Open now" on a Sunday.
 */

/**
 * The storefront's own public origin.
 *
 * Shared by `layout.tsx` (`metadataBase`), `robots.ts` and `sitemap.ts`, so
 * the canonical URL, the sitemap's entries and `og:image` all agree on one
 * host. A preview deployment overrides it; production's default is the real
 * domain, because an unset variable here is invisible until Google indexes
 * `localhost:3000`.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://edawr.in').replace(
  /\/+$/,
  '',
);

/**
 * How long a server-side render will wait on the API for metadata.
 *
 * The page wrappers fetch the store config, a category name or a product on
 * the server so a crawler gets real titles and structured data. Those fetches
 * run *before* the HTML is sent, and `request()` waits 15 s per attempt with
 * retries — so an API that hangs would hold the home page for most of a
 * minute for every visitor, crawler or not. A caller's own signal makes
 * `request()` give up at once and skip the retries. Three seconds is longer
 * than any healthy answer and shorter than a customer's patience; on a miss
 * the page renders with the static metadata, which is still correct.
 */
export const SEO_FETCH_BUDGET_MS = 3_000;

/** A fresh abort signal for one metadata fetch. */
export const seoSignal = () => AbortSignal.timeout(SEO_FETCH_BUDGET_MS);

/**
 * The sitemap's budget, longer because it pages through the whole catalogue
 * — several requests, not one — and because nobody is waiting on it but a
 * crawler. Still bounded: past this Search Console reports "Couldn't fetch",
 * and the static pages are worth listing on their own.
 */
export const SITEMAP_FETCH_BUDGET_MS = 10_000;

/** Absolute URL for a path on this site. */
export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/**
 * Pages worth indexing: the shop itself. Listed by hand rather than derived
 * from the file tree so adding a route is a decision about whether Google
 * should see it — a checkout page in the index is a page that 404s for
 * every visitor who arrives without a basket.
 */
export const INDEXABLE_PATHS = ['/', '/products', '/categories', '/offers'] as const;

/**
 * Pages that are one customer's business. Each of these carries
 * `robots: noindex` in its metadata, which is the mechanism that keeps them
 * out of results — not `robots.txt`, which must *not* disallow them, because
 * a crawler that may not fetch a page never sees its `noindex` (see
 * `app/robots.ts`). The list exists so `seo.test.ts` can check nothing here
 * is also in `INDEXABLE_PATHS`, and so the next person knows which pages
 * are meant to be private. `/order/` covers every tracking token.
 */
export const PRIVATE_PATHS = [
  '/cart',
  '/checkout',
  '/account',
  '/addresses',
  '/orders',
  '/order/',
  '/search',
  '/signin',
  '/signup',
] as const;

export const categoryPath = (name: string) => `/category/${slugify(name)}`;
export const productPath = (id: number) => `/product/${id}`;

/* -------------------------------------------------------------------------- */
/* JSON-LD                                                                    */
/* -------------------------------------------------------------------------- */

type JsonLd = Record<string, unknown>;

/**
 * "HH:MM" from the API's "HH:MM:SS". schema.org wants the former; Django's
 * TimeField serialises the latter. Anything unparseable is dropped rather
 * than guessed — a wrong opening hour in a search snippet is worse than none.
 */
export function clockTime(value: string | null | undefined): string | null {
  const match = /^(\d{2}):(\d{2})/.exec(value ?? '');
  return match ? `${match[1]}:${match[2]}` : null;
}

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * The shop, as a local business.
 *
 * `GroceryStore` is a `LocalBusiness`, which is the type that earns a map pin
 * and opening hours in a result. The address is the city only: the API does
 * not publish a street address and this must not make one up. Coordinates and
 * hours are included when the config carries them, because "grocery delivery
 * near me" is a query answered by geography.
 */
export function storeJsonLd(config: StoreConfig | null): JsonLd {
  const name = config?.store_name || 'eDawr';
  const city = config?.store_city || 'Aizawl';
  const opens = clockTime(config?.opens_at);
  const closes = clockTime(config?.closes_at);

  const business: JsonLd = {
    '@type': 'GroceryStore',
    '@id': `${SITE_URL}/#store`,
    name,
    url: SITE_URL,
    image: absoluteUrl('/opengraph-image.png'),
    logo: absoluteUrl('/icon-512.png'),
    description: `${name} delivers groceries, fresh produce, snacks and household essentials across ${city} in minutes.`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: city,
      addressRegion: 'Mizoram',
      addressCountry: 'IN',
    },
    areaServed: { '@type': 'City', name: city },
    priceRange: '₹',
    currenciesAccepted: 'INR',
    paymentAccepted: 'Cash',
  };

  if (config && Number.isFinite(config.store_latitude) && Number.isFinite(config.store_longitude)) {
    business.geo = {
      '@type': 'GeoCoordinates',
      latitude: config.store_latitude,
      longitude: config.store_longitude,
    };
  }

  if (opens && closes) {
    business.openingHoursSpecification = [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: WEEK, opens, closes },
    ];
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      business,
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name,
        publisher: { '@id': `${SITE_URL}/#store` },
        // Tells Google the site has its own search, which can surface a
        // search box under the result. `/search?q=` is what SearchPage reads.
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={query}` },
          'query-input': 'required name=query',
        },
      },
    ],
  };
}

/**
 * One product, with an offer.
 *
 * Price and availability are the product's own fields, straight from the API
 * — this is display, not arithmetic, the same rule the cart follows. The
 * offer's URL is the product page, so a rich result lands the customer where
 * they can add it.
 */
export function productJsonLd(product: StoreProduct): JsonLd {
  const image = assetUrl(product.image_url);
  const ld: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${absoluteUrl(productPath(product.id))}#product`,
    name: product.name,
    url: absoluteUrl(productPath(product.id)),
    sku: String(product.id),
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(productPath(product.id)),
      priceCurrency: 'INR',
      price: product.price,
      availability: product.in_stock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': `${SITE_URL}/#store` },
    },
  };
  if (product.description) ld.description = product.description;
  if (product.brand) ld.brand = { '@type': 'Brand', name: product.brand };
  if (product.category) ld.category = product.category;
  if (image) ld.image = image.startsWith('http') ? image : absoluteUrl(image);
  return ld;
}

/** Home › Category › Product, as Google draws it under a result. */
export function breadcrumbJsonLd(trail: Array<{ name: string; path: string }>): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * Serialise for a `<script type="application/ld+json">`.
 *
 * `<` is escaped so a product description containing `</script>` cannot end
 * the block early. JSON is still valid with `<` in a string, and the
 * parser Google runs reads it back as `<`.
 */
export function jsonLdString(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
