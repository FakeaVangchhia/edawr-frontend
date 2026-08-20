import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductPage } from './ProductPage';
import { fetchProduct } from '@/lib/store-api';

/**
 * `params` is a Promise in this version of Next.js and must be awaited.
 *
 * The metadata is generated on the server, which means it fetches the product a
 * second time — once here for the <title> and OG tags, once in the browser for
 * the page itself. That is the price of a product link that unfurls correctly
 * when someone shares it, and the request is cheap and cacheable.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric)) return { title: 'Product' };

  try {
    const product = await fetchProduct(numeric);
    const description =
      product.description ?? `${product.name}${product.unit ? ` · ${product.unit}` : ''}`;
    return {
      title: product.name,
      description,
      openGraph: { title: product.name, description, type: 'website' },
    };
  } catch {
    // An unreachable API must not fail the render — the page below shows its
    // own error state, and a missing <title> is the least of that problem.
    return { title: 'Product' };
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numeric = Number(id);
  // Product ids are integers; the backend route uses <int:product_id> and would
  // 404 on anything else, so reject it here rather than firing a doomed request.
  if (!Number.isInteger(numeric) || numeric <= 0) notFound();

  return <ProductPage id={numeric} />;
}
