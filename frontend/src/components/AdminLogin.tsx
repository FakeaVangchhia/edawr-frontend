'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, LockKeyhole, Mail, Store } from 'lucide-react';
import { apiUrl } from '../lib/api';
import { AdminSession } from '../types';

type AdminLoginProps = {
  onBackToStore: () => void;
  onLogin: (session: AdminSession) => void;
  initialError?: string | null;
};

export default function AdminLogin({ onBackToStore, onLogin, initialError }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(initialError || '');

  const helperText = useMemo(
    () => 'Sign in with your admin email and password.',
    []
  );

  // Sync initialError from props to state
  useEffect(() => {
    if (initialError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(initialError);
    }
  }, [initialError]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const normalizedEmail = email.trim();
    const normalizedPassword = password;

    if (!normalizedEmail || !normalizedPassword) {
      setError('Enter email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Expects the backend to return { access_token, username? }.
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: normalizedPassword }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to sign in.');
      }

      if (!data.access_token) {
        throw new Error('Could not establish an active session.');
      }

      onLogin({
        username: data.username || normalizedEmail,
        accessToken: data.access_token,
      });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <section className="panel rounded-[2.25rem] p-8 sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/15">
            <Store className="h-6 w-6" />
          </div>
          <div className="section-label mt-8">Admin Access</div>
          <h1 className="mt-2 max-w-xl text-4xl font-black tracking-tight text-slate-950">
            Sign in to open the dashboard.
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
            Admin access is authenticated by the backend API.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="text-sm text-slate-500">Access</div>
              <div className="mt-1 text-xl font-black text-slate-950">Admin</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="text-sm text-slate-500">Security</div>
              <div className="mt-1 text-xl font-black text-slate-950">SSL/JWT</div>
            </div>
          </div>
        </section>

        <section className="panel rounded-[2.25rem] p-6 sm:p-8">
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">Login</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{helperText}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Email Address</span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="admin@example.com"
                    className="field-control py-3 pl-10 pr-4"
                    autoComplete="email"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="field-control py-3 pl-10 pr-4"
                    autoComplete="current-password"
                  />
                </div>
              </label>

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="primary-action inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>

              <button
                type="button"
                onClick={onBackToStore}
                className="secondary-action inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Store
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
