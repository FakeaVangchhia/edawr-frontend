'use client';

/* eslint-disable @next/next/no-img-element -- Product and category images are
   served by the Django backend, and its hostname is only known at runtime from
   NEXT_PUBLIC_API_URL. next/image needs `remotePatterns` configured at build
   time, which would mean baking the API host into the bundle — the one thing
   `lib/api.ts` exists to avoid. Plain <img> it is. */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { assetUrl } from '@/lib/api';
import { slugify } from '@/lib/catalogue';
import { fetchCategories } from '@/lib/store-api';
import { ImageFallback } from '@/components/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useStoreConfig } from '@/hooks/useStoreData';
import type { StoreCategory } from '@/types';

/**
 * Every aisle in the store.
 *
 * The list comes from `/api/store/categories`, which builds itself from the
 * products that actually exist rather than from the category table — so an
 * aisle with nothing sellable in it never renders as an empty shelf.
 */
export function CategoriesPage() {
  const config = useStoreConfig();
  const [categories, setCategories] = useState<StoreCategory[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetchCategories(controller.signal)
      .then(setCategories)
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : 'Could not load the aisles.');
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="container-page py-10 lg:py-16">
      <h1 className="text-3xl font-semibold lg:text-5xl">Aisles</h1>
      <p className="mt-3 text-muted-foreground">
        {categories
          ? `${categories.length} ${categories.length === 1 ? 'aisle' : 'aisles'}. Everything arrives${
              config ? ` in about ${config.promise_minutes} minutes` : ' in minutes'
            }.`
          : 'Everything you need, organised for a one-second decision.'}
      </p>

      {error && <p className="mt-8 text-sm text-destructive">{error}</p>}

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {categories
          ? categories.map((category) => {
              const image = assetUrl(category.image_url);
              return (
                <Link
                  key={category.name}
                  href={`/category/${slugify(category.name)}`}
                  className="group rounded-3xl border border-border/70 bg-card p-3 transition-all duration-400 ease-[var(--ease-apple)] hover:-translate-y-1 hover:shadow-lift"
                >
                  <div className="overflow-hidden rounded-2xl bg-surface">
                    {image ? (
                      <img
                        src={image}
                        alt=""
                        loading="lazy"
                        width={800}
                        height={800}
                        className="aspect-square w-full object-cover transition-transform duration-700 ease-[var(--ease-apple)] group-hover:scale-105"
                      />
                    ) : (
                      <ImageFallback name={category.name} className="aspect-square w-full" />
                    )}
                  </div>
                  <p className="mt-3 px-1 text-[15px] font-semibold">{category.name}</p>
                  <p className="num px-1 pb-1 text-xs text-muted-foreground">
                    {category.product_count} {category.product_count === 1 ? 'item' : 'items'}
                  </p>
                </Link>
              );
            })
          : Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-64 rounded-3xl" />
            ))}
      </div>
    </div>
  );
}
