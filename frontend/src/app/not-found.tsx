import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
      <div className="max-w-md">
        <p className="num text-7xl font-semibold tracking-tight">404</p>
        <h1 className="mt-4 text-2xl font-semibold">This page doesn&apos;t exist</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for has moved, or was never here. Everything you need is
          still a few minutes away.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-12 items-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition-all duration-300 ease-[var(--ease-apple)] hover:-translate-y-0.5 hover:shadow-lift"
          >
            Go home
          </Link>
          <Link
            href="/products"
            className="inline-flex h-12 items-center rounded-full border border-border px-7 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Shop everything
          </Link>
        </div>
      </div>
    </div>
  );
}
