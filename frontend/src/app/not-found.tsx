import Link from 'next/link';
import { PackageSearch } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-sunken)] px-4">
      <div className="card flex max-w-sm flex-col items-center gap-3 p-8 text-center">
        <PackageSearch className="h-9 w-9 text-[var(--color-ink-faint)]" aria-hidden />
        <h1 className="text-lg font-extrabold">Page not found</h1>
        <p className="text-sm text-[var(--color-ink-soft)]">
          That link does not lead anywhere in the store.
        </p>
        <Link href="/" className="btn-primary mt-2">
          Back to store
        </Link>
      </div>
    </div>
  );
}
