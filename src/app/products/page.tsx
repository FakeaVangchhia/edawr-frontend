import type { Metadata } from 'next';
import { ProductsPage } from './ProductsPage';

export const metadata: Metadata = {
  title: 'Shop all products',
  description:
    'Every product eDawr stocks, filterable by aisle — groceries, fresh produce, snacks, beverages and household essentials.',
};

export default function Page() {
  return <ProductsPage />;
}
