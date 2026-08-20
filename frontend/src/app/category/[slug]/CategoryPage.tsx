'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { categoryForSlug } from '@/lib/catalogue';
import { fetchCategories, fetchProducts } from '@/lib/store-api';
import { ProductGrid } from '@/components/ProductGrid';
import { Skeleton } from '@/components/ui/skeleton';
import { usePromiseMinutes } from '@/hooks/useStoreData';
import type { StoreCategory, StoreProduct } from '@/types';

/**
 * One aisle.
 *
 * `Product.category` is free text with no id, so the URL carries a slug derived
 * from the name and this resolves it by matching derived slugs — see
 * `lib/catalogue.ts`. That means the category list has to load before the
 * products can be fetched, which is why this is two sequential requests rather
 * than one.
 *
 * An unrecognised slug renders a "no such aisle" state rather than calling
 * `notFound()`: the resolution happens in the browser, after the route has
 * already been served, and the shell around it should stay usable.
 */

const PAGE_SIZE = 60;

interface Resolved {
  category: StoreCategory | null;
  products: StoreProduct[];
  error: string;
}

export function CategoryPage({ slug }: { slug: string }) {
  const [state, setState] = useState<Resolved | null>(null);
  const promiseMinutes = usePromiseMinutes();

  useEffect(() => {
    const controller = new AbortController();

    fetchCategories(controller.signal)
      .then(async (categories) => {
        const category = categoryForSlug(categories, slug);
        if (!category) return { category: null, products: [], error: '' };

        const products = await fetchProducts(
          { category: category.name, limit: PAGE_SIZE },
          controller.signal,
        );
        return { category, products, error: '' };
      })
      .then(setState)
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          category: null,
          products: [],
          error: caught instanceof Error ? caught.message : 'Could not load this aisle.',
        });
      });

    return () => controller.abort();
  }, [slug]);

  if (state === null) {
    return (
      <div className="container-page py-10 lg:py-16">
        <Skeleton className="h-5 w-48 rounded-full" />
        <Skeleton className="mt-6 h-12 w-72 rounded-2xl" />
        <div className="mt-10">
          <ProductGrid products={[]} isLoading />
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-2xl font-semibold">This aisle didn&apos;t load</h1>
        <p className="mt-2 text-sm text-destructive">{state.error}</p>
        <Link
          href="/categories"
          className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition-all duration-300 ease-[var(--ease-apple)] hover:-translate-y-0.5 hover:shadow-lift"
        >
          All aisles
        </Link>
      </div>
    );
  }

  if (!state.category) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-2xl font-semibold">No such aisle</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This aisle has been renamed or is no longer stocked.
        </p>
        <Link
          href="/categories"
          className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition-all duration-300 ease-[var(--ease-apple)] hover:-translate-y-0.5 hover:shadow-lift"
        >
          Browse all aisles
        </Link>
      </div>
    );
  }

  const { category, products } = state;

  return (
    <div className="container-page py-10 lg:py-16">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <Link href="/categories" className="transition-colors hover:text-foreground">
          Aisles
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-foreground">{category.name}</span>
      </nav>

      <h1 className="mt-6 text-3xl font-semibold lg:text-5xl">{category.name}</h1>
      <p className="num mt-3 text-muted-foreground">
        {products.length} {products.length === 1 ? 'item' : 'items'} in stock
      </p>

      <div className="mt-10">
        <ProductGrid
          products={products}
          isLoading={false}
          promiseMinutes={promiseMinutes}
          emptyTitle="Nothing in this aisle right now"
          emptyBody="Everything here has sold out. It will be back once the shelf is restocked."
        />
      </div>
    </div>
  );
}
