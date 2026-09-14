import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductPage } from './ProductPage';
import { JsonLd } from '@/components/JsonLd';
import { assetUrl } from '@/lib/api';
import { fetchProduct } from '@/lib/store-api';
import { breadcrumbJsonLd, categoryPath, productJsonLd, productPath, seoSignal } from '@/lib/seo';

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
    const product = await fetchProduct(numeric, seoSignal());
    const description =
      product.description ??
      `${product.name}${product.unit ? ` · ${product.unit}` : ''} — delivered across Aizawl in minutes by eDawr.`;
    const image = assetUrl(product.image_url);
    return {
      title: product.name,
      description,
      alternates: { canonical: productPath(product.id) },
      openGraph: {
        title: product.name,
        description,
        type: 'website',
        // The product's own photo on a shared link, falling back to the
        // file-convention card when there is none.
        ...(image ? { images: [{ url: image, alt: product.name }] } : {}),
      },
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

  // Fetched a second time for the structured data, like the metadata above,
  // and for the same reason: a crawler reads the HTML and runs nothing. A
  // failed fetch drops the JSON-LD and renders the page, whose own error
  // state handles the rest.
  const product = await fetchProduct(numeric, seoSignal()).catch(() => null);

  return (
    <>
      {product && (
        <>
          <JsonLd data={productJsonLd(product)} />
          <JsonLd
            data={breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              ...(product.category
                ? [{ name: product.category, path: categoryPath(product.category) }]
                : []),
              { name: product.name, path: productPath(product.id) },
            ])}
          />
        </>
      )}
      <ProductPage id={numeric} />
    </>
  );
}
