import type { MetadataRoute } from 'next';
import { fetchAllProducts, fetchCategories } from '@/lib/store-api';
import {
  INDEXABLE_PATHS,
  SITEMAP_FETCH_BUDGET_MS,
  absoluteUrl,
  categoryPath,
  productPath,
} from '@/lib/seo';

/**
 * `/sitemap.xml`, from the live catalogue.
 *
 * The public pages by hand, then every category and every in-stock product
 * from the API. Built per request rather than at `next build`, because the
 * build runs without an API to ask (CI, a fresh deploy) and a sitemap frozen
 * at build time would list the catalogue as it was on release day. Google
 * fetches this a few times a day at most; two API calls is nothing.
 *
 * If the API is unreachable the static pages are still listed. A sitemap that
 * 500s is a sitemap Google stops trusting.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = INDEXABLE_PATHS.map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency: path === '/' ? 'daily' : 'weekly',
    priority: path === '/' ? 1 : 0.8,
  }));

  try {
    // One budget for both: a hung API must not hold the sitemap for the
    // request layer's full retry schedule (~46 s) before the fallback.
    const signal = AbortSignal.timeout(SITEMAP_FETCH_BUDGET_MS);
    const [categories, products] = await Promise.all([
      fetchCategories(signal),
      fetchAllProducts(signal),
    ]);
    for (const category of categories) {
      entries.push({
        url: absoluteUrl(categoryPath(category.name)),
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }
    for (const product of products) {
      // Out-of-stock products stay listed: the page exists and says so, and a
      // product that is back tomorrow should not have dropped out of the index.
      entries.push({
        url: absoluteUrl(productPath(product.id)),
        lastModified: now,
        changeFrequency: 'weekly',
        priority: product.in_stock ? 0.6 : 0.3,
      });
    }
  } catch {
    // Listed above: the four pages that exist regardless.
  }

  return entries;
}
