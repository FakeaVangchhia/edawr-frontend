import { useMemo, useState } from 'react';
import AdminShell from './components/AdminShell';
import AdminLogin from './components/AdminLogin';
import Storefront from './components/Storefront';
import { AdminSession } from './types';
import { ADMIN_SESSION_KEY } from './lib/auth';

export default function App() {
  const storedAdmin = useMemo<AdminSession | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const rawValue = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue) as AdminSession;
    } catch {
      window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }
  }, []);

  const initialView = useMemo<'store' | 'login' | 'admin'>(() => {
    if (typeof window === 'undefined') {
      return 'store';
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('view') !== 'admin') {
      return 'store';
    }

    return storedAdmin ? 'admin' : 'login';
  }, [storedAdmin]);

  const [view, setView] = useState<'store' | 'login' | 'admin'>(initialView);
  const [adminUser, setAdminUser] = useState<AdminSession | null>(storedAdmin);

  const handleLogin = (session: AdminSession) => {
    setAdminUser(session);
    setView('admin');
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    }
  };

  const handleLogout = () => {
    setAdminUser(null);
    setView('login');
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    }
  };

  return (
    <div className="app-shell">
      {view === 'admin' && adminUser ? (
        <AdminShell
          adminUser={adminUser}
          onBackToStore={() => setView('store')}
          onLogout={handleLogout}
        />
      ) : view === 'login' ? (
        <AdminLogin
          onBackToStore={() => setView('store')}
          onLogin={handleLogin}
        />
      ) : (
        <Storefront onOpenAdmin={() => setView(adminUser ? 'admin' : 'login')} />
      )}
    </div>
  );
}
