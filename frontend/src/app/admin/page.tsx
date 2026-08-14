'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import AdminLogin from '@/components/AdminLogin';
import { AdminSession } from '@/types';
import { ADMIN_SESSION_KEY } from '@/lib/auth';
import { authRequest } from '@/lib/api';

export default function AdminPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<AdminSession | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [errorParam, setErrorParam] = useState<string | null>(null);

  // Surface any auth error passed back in the URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('error');
      if (err) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setErrorParam(
          err === 'auth-failed'
            ? 'Authentication failed. Please try again.'
            : decodeURIComponent(err)
        );
        // Clear the error parameter from URL to prevent showing on refresh
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }, []);

  useEffect(() => {
    // Restore a previously stored admin session, and verify the token is still
    // good before rendering the console. Without this check an expired token
    // renders a dashboard whose every request 401s.
    if (typeof window === 'undefined') return;

    const restore = async () => {
      const rawValue = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
      if (!rawValue) {
        setIsInitialized(true);
        return;
      }

      let stored: AdminSession | null = null;
      try {
        stored = JSON.parse(rawValue) as AdminSession;
      } catch {
        window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
        setIsInitialized(true);
        return;
      }

      try {
        // The backend hands back a refreshed token; keep the newer one.
        const data = await authRequest<{ username?: string; access_token?: string }>(
          '/api/auth/me',
        );
        const session: AdminSession = {
          username: data.username || stored.username,
          accessToken: data.access_token || stored.accessToken,
        };
        window.sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
        setAdminUser(session);
      } catch {
        window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
        setErrorParam('Your session has expired. Please sign in again.');
      } finally {
        setIsInitialized(true);
      }
    };

    void restore();
  }, []);

  const handleLogin = (session: AdminSession) => {
    setAdminUser(session);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    }
  };

  const handleLogout = () => {
    setAdminUser(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    }
  };

  const handleBackToStore = () => {
    router.push('/');
  };

  if (!isInitialized) {
    return (
      // No wrapper background: `body` already paints --color-surface-sunken and
      // LiquidBackdrop sits behind it, so anything opaque here would cover the
      // backdrop the glass panels exist to refract.
      <div className="flex min-h-dvh items-center justify-center">
        <p className="animate-pulse font-semibold text-[var(--color-ink-faint)]">
          Loading console…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      {adminUser ? (
        <AdminShell
          adminUser={adminUser}
          onBackToStore={handleBackToStore}
          onLogout={handleLogout}
        />
      ) : (
        <AdminLogin
          onBackToStore={handleBackToStore}
          onLogin={handleLogin}
          initialError={errorParam}
        />
      )}
    </div>
  );
}

