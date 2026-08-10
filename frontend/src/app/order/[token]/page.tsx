import type { Metadata } from 'next';
import OrderTracker from '@/components/store/OrderTracker';

export const metadata: Metadata = {
  title: 'Track your order · eDawr',
  description: 'Live status of your eDawr delivery.',
  // The URL contains the token that authorises reading this order. Keeping it
  // out of search results is the least we can do; the page is still reachable
  // by anyone the customer shares the link with, which is the intended model.
  robots: { index: false, follow: false },
};

/**
 * `params` is a Promise in this version of Next.js and must be awaited — it is
 * not the synchronous object older App Router code passes around.
 */
export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <OrderTracker token={token} />;
}
