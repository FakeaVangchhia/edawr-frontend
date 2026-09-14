import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * `/robots.txt`.
 *
 * Everything is crawlable, on purpose. The per-customer pages — basket,
 * checkout, account, order tracking — are kept out of results by the
 * `noindex` each of them carries, and **a `noindex` only works on a page the
 * crawler is allowed to fetch**. A `Disallow` here would stop Google reading
 * the page and therefore stop it reading the `noindex`; a tracking link
 * someone pasted into a public group would then be indexed as a bare URL
 * with no content, which is the opposite of the intent. So the list of
 * private paths lives in `lib/seo.ts` as documentation and as the test's
 * cross-check against the indexable set, and does not appear here.
 *
 * The sitemap line is what gets a new shop discovered at all: without it
 * Google has to find every product by following links through
 * client-rendered pages.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
