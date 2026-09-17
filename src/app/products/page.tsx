import type { Metadata } from 'next';
import { ProductsPage } from './ProductsPage';

export const metadata: Metadata = {
  title: 'Shop all products',
  description:
    'Every product eDawr stocks, filterable by category — groceries, fresh produce, snacks, beverages and household essentials.',
  alternates: { canonical: '/products' },
};

/**
 * `?category=Dairy` pre-selects a filter chip, which is how a category page
 * hands over when it has more items than it shows. `searchParams` is a Promise
 * in Next 16 and has to be awaited.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const { category } = await searchParams;
  return <ProductsPage initialCategory={typeof category === 'string' ? category : undefined} />;
}
