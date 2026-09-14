import type { Metadata } from 'next';
import { HomePage } from './HomePage';
import { JsonLd } from '@/components/JsonLd';
import { fetchPromos, fetchStoreConfig } from '@/lib/store-api';
import { seoSignal, storeJsonLd } from '@/lib/seo';

/**
 * The storefront home.
 *
 * A server component wrapping a client one, so the page's metadata is static
 * and the structured data below is in the HTML a crawler receives: everything
 * else on the page depends on the customer's basket and saved address, which
 * only exist in the browser.
 */
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function Page() {
  // The store's real name, city, hours and coordinates for the LocalBusiness
  // block. An unreachable API must not fail — or stall — the home page:
  // `seoSignal` caps the wait, and `storeJsonLd` falls back to the name and
  // city alone, which is still true.
  //
  // The banners come the same way, and for a second reason: fetched in the
  // browser, the carousel had to reserve space it usually did not fill (see
  // `PromoCarousel`). A failed fetch is an empty rail, which is what the page
  // shows when there genuinely are none.
  const [config, promos] = await Promise.all([
    fetchStoreConfig(seoSignal()).catch(() => null),
    fetchPromos(seoSignal()).catch(() => []),
  ]);

  return (
    <>
      <JsonLd data={storeJsonLd(config)} />
      <HomePage promos={promos} />
    </>
  );
}
