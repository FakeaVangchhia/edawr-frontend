import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SearchPage } from './SearchPage';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search groceries, snacks, beverages and household essentials on eDawr.',
  // Results pages are per-query and thin; there is nothing here worth indexing.
  robots: { index: false, follow: true },
};

/**
 * `useSearchParams` opts the tree into client-side rendering, and Next requires
 * a Suspense boundary around it so the rest of the page can still be
 * prerendered. Without this the build fails rather than warning.
 */
export default function Page() {
  return (
    <Suspense fallback={<div className="container-page py-12" />}>
      <SearchPage />
    </Suspense>
  );
}
