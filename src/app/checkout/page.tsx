import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CheckoutPage } from './CheckoutPage';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Confirm your address and place your order.',
  robots: { index: false, follow: false },
};

/** `useSearchParams` (for the delivery tier) needs a Suspense boundary. */
export default function Page() {
  return (
    <Suspense fallback={<div className="container-page py-12" />}>
      <CheckoutPage />
    </Suspense>
  );
}
