'use client';

import { ProductCard } from '@/components/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { StoreProduct } from '@/types';

/**
 * The catalogue grid, plus its loading and empty states.
 *
 * Shared by /products, /category/[slug] and /search so all three have the same
 * column counts and the same empty message shape. They differ only in what they
 * fetched, which is the point.
 */
export function ProductGrid({
  products,
  isLoading,
  promiseMinutes = null,
  emptyTitle = 'Nothing here yet',
  emptyBody = 'Try another aisle, or search for something specific.',
}: {
  products: StoreProduct[];
  isLoading: boolean;
  promiseMinutes?: number | null;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton key={index} className="h-72 rounded-3xl" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-4xl border border-border/70 py-20 text-center">
        <h2 className="text-lg font-semibold">{emptyTitle}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} promiseMinutes={promiseMinutes} />
      ))}
    </div>
  );
}
