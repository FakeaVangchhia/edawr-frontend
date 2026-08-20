import type { Metadata } from 'next';
import { AddressesPage } from './AddressesPage';

export const metadata: Metadata = {
  title: 'Addresses',
  description: 'Choose where your eDawr orders are delivered.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AddressesPage />;
}
