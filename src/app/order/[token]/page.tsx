import type { Metadata } from 'next';
import { OrderTracker } from './OrderTracker';

export const metadata: Metadata = {
  title: 'Track your order',
  description: 'Live tracking for your eDawr order.',
  // The URL *is* the credential — an indexed tracking page would publish a
  // customer's address to anyone who searched for it.
  robots: { index: false, follow: false },
};

/** `params` is a Promise in this version of Next.js and must be awaited. */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <OrderTracker token={token} />;
}
