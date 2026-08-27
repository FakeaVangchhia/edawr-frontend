import type { Metadata } from 'next';
import { OffersPage } from './OffersPage';

export const metadata: Metadata = {
  title: 'Offers',
  description:
    'Current eDawr offers: free delivery above the threshold, delivery speeds and everything reduced below MRP today.',
};

export default function Page() {
  return <OffersPage />;
}
