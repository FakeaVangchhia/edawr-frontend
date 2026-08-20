import type { Metadata } from 'next';
import { OrdersPage } from './OrdersPage';

export const metadata: Metadata = {
  title: 'Your orders',
  description: 'Track live orders and revisit what you have bought.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <OrdersPage />;
}
