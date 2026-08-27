import type { Metadata } from 'next';
import { CartPage } from './CartPage';

export const metadata: Metadata = {
  title: 'Your basket',
  description: 'Review your basket and place your order in seconds.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <CartPage />;
}
