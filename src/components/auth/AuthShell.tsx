'use client';

/**
 * The furniture both auth pages share: a card, a field and an error region.
 *
 * Kept here rather than in either page because the two forms have to look and
 * behave identically — a sign-up that styles its inputs differently from
 * sign-in reads as a different site, which is exactly the moment someone is
 * deciding whether to trust it with a password.
 *
 * The inputs are the storefront's own idiom (`CheckoutPage`'s `Field`) rather
 * than anything imported from `admin/`: the two packages deploy separately and
 * share no modules, and their CSS conventions differ.
 */

import Link from 'next/link';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="container-page flex justify-center py-10 lg:py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

        <div className="mt-6 rounded-3xl border border-border bg-surface p-6">
          {children}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      aria-live="polite"
      className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      {message}
    </p>
  );
}

export function AuthSwitchLink({ href, prompt, action }: { href: string; prompt: string; action: string }) {
  return (
    <>
      {prompt}{' '}
      <Link href={href} className="font-medium text-foreground underline underline-offset-4">
        {action}
      </Link>
    </>
  );
}
