import type { Metadata } from 'next';
import { AccountPage } from './AccountPage';

export const metadata: Metadata = {
  title: 'Your details',
  description: 'The name, number and addresses checkout fills itself in with.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AccountPage />;
}
