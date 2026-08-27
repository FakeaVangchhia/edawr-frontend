import type { Metadata } from 'next';
import { CategoriesPage } from './CategoriesPage';

export const metadata: Metadata = {
  title: 'Aisles',
  description:
    'Browse every aisle eDawr stocks — groceries, fresh produce, dairy, snacks, beverages and household essentials, delivered across Aizawl in minutes.',
};

export default function Page() {
  return <CategoriesPage />;
}
