'use client';

import { useEffect, useState } from 'react';
import { SORT_LABELS, sortProducts, type SortKey } from '@/lib/catalogue';
import { fetchCategories, fetchProducts } from '@/lib/store-api';
import { ProductGrid } from '@/components/ProductGrid';
import { usePromiseMinutes } from '@/hooks/useStoreData';
import { cn } from '@/lib/utils';
import type { StoreCategory, StoreProduct } from '@/types';

/**
 * The whole catalogue, filterable by aisle.
 *
 * The aisle filter is a **server** filter — it re-fetches with `?category=`
 * rather than filtering an array that was already downloaded. The sort is
 * client-side, because it only reorders the page that came back; it never
 * changes which products are in it.
 *
 * Fetched data is tagged with the aisle that produced it, so a slow response
 * for one aisle cannot land after a fast one for another and show the wrong
 * products under the right heading. The loading flag is derived from that tag
 * rather than stored, which keeps every `setState` off the synchronous path of
 * an effect.
 */

const PAGE_SIZE = 60;
const ALL = 'All';

interface Loaded {
  aisle: string;
  products: StoreProduct[];
  error: string;
}

export function ProductsPage({ initialCategory }: { initialCategory?: string }) {
  const [aisle, setAisle] = useState(initialCategory ?? ALL);
  const [sort, setSort] = useState<SortKey>('recommended');
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const promiseMinutes = usePromiseMinutes();

  useEffect(() => {
    const controller = new AbortController();
    fetchCategories(controller.signal)
      .then(setCategories)
      .catch(() => {
        /* The filter chips are a convenience; the grid still loads. */
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchProducts({ category: aisle, limit: PAGE_SIZE }, controller.signal)
      .then((products) => setLoaded({ aisle, products, error: '' }))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({
          aisle,
          products: [],
          error: caught instanceof Error ? caught.message : 'Could not load the catalogue.',
        });
      });

    return () => controller.abort();
  }, [aisle]);

  const current = loaded?.aisle === aisle ? loaded : null;
  const isLoading = current === null;
  const products = current ? sortProducts(current.products, sort) : [];

  return (
    <div className="container-page py-10 lg:py-16">
      <h1 className="text-3xl font-semibold lg:text-5xl">Shop everything</h1>
      <p className="mt-3 text-muted-foreground">
        The full catalogue, filterable by aisle. Everything arrives on the same promise.
      </p>

      <div className="no-scrollbar -mx-5 mt-8 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
        <FilterChip label="All" active={aisle === ALL} onClick={() => setAisle(ALL)} />
        {categories.map((category) => (
          <FilterChip
            key={category.name}
            label={category.name}
            count={category.product_count}
            active={aisle === category.name}
            onClick={() => setAisle(category.name)}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="num text-sm text-muted-foreground">
          {isLoading ? 'Loading…' : `${products.length} ${products.length === 1 ? 'item' : 'items'}`}
        </p>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="h-10 rounded-full border border-border bg-surface px-4 text-sm outline-none transition-colors focus:border-primary/25"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {current?.error && <p className="mt-6 text-sm text-destructive">{current.error}</p>}

      <div className="mt-6">
        <ProductGrid
          products={products}
          isLoading={isLoading}
          promiseMinutes={promiseMinutes}
          emptyTitle="This aisle is empty"
          emptyBody="Nothing is in stock here right now. Try another aisle."
        />
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ease-[var(--ease-apple)]',
        active
          ? 'bg-primary text-primary-foreground'
          : 'border border-border bg-surface hover:bg-secondary',
      )}
    >
      {label}
      {count !== undefined && <span className="num ml-1.5 text-xs opacity-60">{count}</span>}
    </button>
  );
}
