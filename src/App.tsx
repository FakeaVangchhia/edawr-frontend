import { useMemo, useState } from 'react';
import AdminShell from './components/AdminShell';
import AdminLogin from './components/AdminLogin';
import Storefront from './components/Storefront';
import { User } from './types';

const ADMIN_SESSION_KEY = 'edawr-admin-session';

export default function App() {
  const storedAdmin = useMemo<User | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const rawValue = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue) as User;
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
  const [adminUser, setAdminUser] = useState<User | null>(storedAdmin);

  const handleLogin = (user: User) => {
    setAdminUser(user);
    setView('admin');
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(user));
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
