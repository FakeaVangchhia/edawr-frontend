import { useMemo, useState } from 'react';
import AdminShell from './components/AdminShell';
import Storefront from './components/Storefront';

export default function App() {
  const initialView = useMemo<'store' | 'admin'>(() => {
    if (typeof window === 'undefined') {
      return 'store';
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'admin' ? 'admin' : 'store';
  }, []);
  const [view, setView] = useState<'store' | 'admin'>(initialView);

  return (
    <div className="min-h-screen">
      {view === 'admin' ? (
        <AdminShell onBackToStore={() => setView('store')} />
      ) : (
        <Storefront onOpenAdmin={() => setView('admin')} />
      )}
    </div>
  );
}
