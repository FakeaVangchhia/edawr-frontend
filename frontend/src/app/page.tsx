'use client';

import { useRouter } from 'next/navigation';
import Storefront from '@/components/Storefront';

export default function Home() {
  const router = useRouter();

  const handleOpenAdmin = () => {
    router.push('/admin');
  };

  return (
    <div className="app-shell">
      <Storefront onOpenAdmin={handleOpenAdmin} />
    </div>
  );
}
