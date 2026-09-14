import type { Metadata } from 'next';
import { ProductsPage } from './ProductsPage';

export const metadata: Metadata = {
  title: 'Shop all products',
  description:
    'Every product eDawr stocks, filterable by category — groceries, fresh produce, snacks, beverages and household essentials.',
  alternates: { canonical: '/products' },
};

export default function Page() {
  return <ProductsPage />;
}
