'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, LockKeyhole, Mail, Store } from 'lucide-react';
import { apiUrl } from '../lib/api';
import { AdminSession } from '../types';

type AdminLoginProps = {
  onBackToStore: () => void;
  onLogin: (session: AdminSession) => void;
  initialError?: string | null;
};

const HELPER_TEXT = 'Sign in with your admin email and password.';

export default function AdminLogin({ onBackToStore, onLogin, initialError }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(initialError || '');

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
    /* `min-h-dvh`, not `min-h-screen`: on iOS Safari `100vh` is taller than
       what you can actually see, so the sign-in button sat under the browser
       toolbar on a phone. The inner grid no longer forces a minimum height at
       all — on a short landscape screen that was pushing the form off the
       bottom with no way to scroll to it. */
    <div className="min-h-dvh px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto grid max-w-6xl items-center gap-5 sm:gap-6 lg:min-h-[calc(100dvh-5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        {/* The marketing half is hidden below `lg`. On a phone it is three
            paragraphs standing between someone and the login form they opened
            the page to use — and it says nothing they need. */}
        <section className="card hidden p-8 sm:p-10 lg:block">
          <div className="brand-gradient flex h-14 w-14 items-center justify-center rounded-2xl text-[var(--color-brand-500)]">
            <Store className="h-6 w-6 text-[var(--color-brand-500)]" aria-hidden />
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
            Admin access
          </p>
          {/* A <p>, not the page heading. This whole section is hidden below
              `lg`, and an <h1> that disappears on a phone leaves the page with
              no heading at all — so the one in the form below is the real one. */}
          <p className="mt-2 max-w-xl font-manrope text-3xl font-black tracking-tight text-balance xl:text-4xl">
            Sign in to open the dashboard.
          </p>
          <p className="mt-3 max-w-xl text-base leading-7 text-[var(--color-ink-soft)]">
            Admin access is authenticated by the backend API.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[var(--color-surface-inset)] px-5 py-4">
              <div className="text-sm text-[var(--color-ink-faint)]">Access</div>
              <div className="mt-1 text-xl font-black">Admin</div>
            </div>
            <div className="rounded-2xl bg-[var(--color-surface-inset)] px-5 py-4">
              <div className="text-sm text-[var(--color-ink-faint)]">Security</div>
              <div className="mt-1 text-xl font-black">SSL/JWT</div>
            </div>
          </div>
        </section>

        <section className="card mx-auto w-full max-w-md p-6 sm:p-8 lg:mx-0 lg:max-w-none">
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Login</h1>
              <p className="mt-2 text-sm leading-6 text-[var(--color-ink-faint)]">
                {HELPER_TEXT}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Email address</span>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-faint)]"
                    aria-hidden
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="admin@example.com"
                    className="field pl-10"
                    autoComplete="email"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Password</span>
                <div className="relative">
                  <LockKeyhole
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-faint)]"
                    aria-hidden
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="field pl-10"
                    autoComplete="current-password"
                  />
                </div>
              </label>

              {error && (
                <div
                  role="alert"
                  className="rounded-2xl bg-[var(--color-danger-50)] px-4 py-3 text-sm font-semibold text-[var(--color-danger-600)]"
                >
                  {error}
                </div>
              )}

              <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </button>

              <button
                type="button"
                onClick={onBackToStore}
                className="btn-ghost inline-flex w-full items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to store
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
