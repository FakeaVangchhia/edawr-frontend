'use client';

/* eslint-disable @next/next/no-img-element -- Product and category images are
   served by the Django backend, and its hostname is only known at runtime from
   NEXT_PUBLIC_API_URL. next/image needs `remotePatterns` configured at build
   time, which would mean baking the API host into the bundle — the one thing
   `lib/api.ts` exists to avoid. Plain <img> it is. */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, PackageCheck, ShieldCheck, Zap } from 'lucide-react';
import { assetUrl } from '@/lib/api';
import { buildHomeRows, slugify, type ProductRow } from '@/lib/catalogue';
import { formatMoney } from '@/lib/format';
import { fetchCategories, fetchProducts } from '@/lib/store-api';
import { ImageFallback, ProductRail } from '@/components/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { selectedAddress } from '@/lib/addresses';
import { useAddressBook, useStoreConfig } from '@/hooks/useStoreData';
import type { StoreCategory } from '@/types';

/**
 * The storefront home.
 *
 * The prototype this design came from drove its six rows off hardcoded tags —
 * "Trending Near You", "Picked for You". `Product` has no tag field and this
 * system has no personalisation, so those rows would have been decoration
 * dressed as data. `buildHomeRows` derives every row from something the API
 * actually says instead; see `lib/catalogue.ts`.
 *
 * The stat strip is the same principle. It shows the store's real promise and
 * its real catalogue size, and nothing else — the prototype's "4.9 customer
 * rating" had no rating system behind it.
 */

/** One page of the catalogue is plenty to build every row from. */
const HOME_PRODUCT_LIMIT = 120;

interface Loaded {
  categories: StoreCategory[];
  rows: ProductRow[];
  productCount: number;
}

export function HomePage() {
  const config = useStoreConfig();
  const book = useAddressBook();
  const address = selectedAddress(book);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetchCategories(controller.signal),
      fetchProducts({ limit: HOME_PRODUCT_LIMIT }, controller.signal),
    ])
      .then(([categories, products]) => {
        setData({
          categories,
          rows: buildHomeRows(products, categories),
          productCount: products.length,
        });
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : 'Could not load the store.');
      });

    return () => controller.abort();
  }, []);

  const city = address?.city || config?.store_city || 'Aizawl';
  const promise = config?.promise_minutes ?? null;

  return (
    <>
      <section className="relative overflow-hidden border-b border-border/70">
        <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-soft px-3 py-1.5 text-xs font-medium text-amber-foreground">
              <Zap className="size-3.5 text-amber" aria-hidden />
              {promise ? `${promise} min delivery` : 'Quick delivery'} · {city}
            </span>

            <h1 className="mt-6 text-[40px] font-semibold leading-[1.04] sm:text-6xl lg:text-[68px]">
              Everything you need.
              <br />
              <span className="text-muted-foreground">
                {promise ? `Delivered in ${promise} minutes.` : 'Delivered in minutes.'}
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-muted-foreground">
              Fresh groceries, essentials, snacks and household staples — brought to your door
              before you have time to think about it.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex h-13 items-center gap-2 rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground transition-all duration-300 ease-[var(--ease-apple)] hover:-translate-y-0.5 hover:shadow-lift"
              >
                Shop now
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/categories"
                className="inline-flex h-13 items-center rounded-full border border-border px-8 text-base font-medium transition-all duration-300 ease-[var(--ease-apple)] hover:-translate-y-0.5 hover:bg-secondary"
              >
                Explore aisles
              </Link>
            </div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t pt-8">
              <Stat
                icon={<Clock className="size-4 text-amber" aria-hidden />}
                label="Our promise"
                value={promise ? `${promise} min` : '—'}
              />
              <Stat
                icon={<PackageCheck className="size-4 text-amber" aria-hidden />}
                label="Aisles"
                value={data ? String(data.categories.length) : '—'}
              />
              <Stat
                icon={<ShieldCheck className="size-4 text-amber" aria-hidden />}
                label="Free over"
                value={config ? formatMoney(config.free_delivery_above) : '—'}
              />
            </dl>
          </div>

          <div className="relative hidden animate-rise lg:block">
            <div className="grid grid-cols-2 gap-4">
              {(data?.categories ?? []).slice(0, 4).map((category) => (
                <CategoryTile key={category.name} category={category} />
              ))}
              {!data &&
                Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="aspect-square rounded-4xl" />
                ))}
            </div>

            {promise !== null && (
              <div className="absolute bottom-6 left-6 flex items-center gap-3 rounded-2xl bg-background/90 px-4 py-3 shadow-lift backdrop-blur-xl">
                <span className="grid size-9 place-items-center rounded-xl bg-amber-soft">
                  <Zap className="size-4 text-amber" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Arriving in {promise} minutes</span>
                  <span className="block text-xs text-muted-foreground">
                    {address ? `Deliver to ${address.label} · ${city}` : `Delivering across ${city}`}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 py-10">
        <div className="container-page">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-2xl font-semibold sm:text-[28px]">Shop by aisle</h2>
            <Link
              href="/categories"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
            </Link>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 lg:mx-0 lg:grid lg:grid-cols-8 lg:px-0">
            {data
              ? data.categories.map((category) => (
                  <Link
                    key={category.name}
                    href={`/category/${slugify(category.name)}`}
                    className="group w-28 shrink-0 text-center lg:w-auto"
                  >
                    <div className="overflow-hidden rounded-3xl border border-border/70 bg-surface transition-all duration-400 ease-[var(--ease-apple)] group-hover:-translate-y-1 group-hover:shadow-card">
                      <CategoryImage category={category} />
                    </div>
                    <p className="mt-2.5 text-[13px] font-medium">{category.name}</p>
                  </Link>
                ))
              : Array.from({ length: 8 }, (_, index) => (
                  <div key={index} className="w-28 shrink-0 lg:w-auto">
                    <Skeleton className="aspect-square rounded-3xl" />
                  </div>
                ))}
          </div>
        </div>
      </section>

      {data?.rows.map((row) => (
        <ProductRail
          key={row.key}
          title={row.title}
          subtitle={row.subtitle}
          items={row.items}
          href={row.href}
          accent={row.accent}
          promiseMinutes={promise}
        />
      ))}

      {config && (
        <section className="py-12">
          <div className="container-page">
            <div className="flex flex-col items-start justify-between gap-6 rounded-4xl bg-primary p-10 text-primary-foreground sm:flex-row sm:items-center lg:p-14">
              <div>
                <h2 className="text-3xl font-semibold lg:text-4xl">
                  Free delivery over {formatMoney(config.free_delivery_above)}.
                </h2>
                <p className="mt-3 max-w-lg text-primary-foreground/70">
                  Applied automatically at checkout — no code to remember. Live tracking on every
                  order.
                </p>
              </div>
              <Link
                href="/products"
                className="inline-flex h-13 shrink-0 items-center gap-2 rounded-full bg-amber px-8 text-base font-semibold text-amber-foreground transition-transform duration-300 ease-[var(--ease-apple)] hover:-translate-y-0.5"
              >
                Start shopping
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="num mt-1 text-2xl font-semibold">{value}</dd>
    </div>
  );
}

function CategoryImage({ category }: { category: StoreCategory }) {
  const image = assetUrl(category.image_url);
  if (!image) return <ImageFallback name={category.name} className="aspect-square w-full" />;
  return (
    <img
      src={image}
      alt=""
      loading="lazy"
      width={800}
      height={800}
      className="aspect-square w-full object-cover"
    />
  );
}

function CategoryTile({ category }: { category: StoreCategory }) {
  return (
    <Link
      href={`/category/${slugify(category.name)}`}
      className="group overflow-hidden rounded-4xl bg-surface transition-all duration-400 ease-[var(--ease-apple)] hover:shadow-lift"
    >
      <CategoryImage category={category} />
      <p className="px-4 py-3 text-sm font-medium">{category.name}</p>
    </Link>
  );
}
