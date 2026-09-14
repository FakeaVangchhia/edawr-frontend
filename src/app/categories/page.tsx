import type { Metadata } from 'next';
import { CategoriesPage } from './CategoriesPage';

export const metadata: Metadata = {
  title: 'Categories',
  description:
    'Browse every category eDawr stocks — groceries, fresh produce, dairy, snacks, beverages and household essentials, delivered across Aizawl in minutes.',
  alternates: { canonical: '/categories' },
};

export default function Page() {
  return <CategoriesPage />;
}
