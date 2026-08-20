'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, PackageCheck, Tag, Zap } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import { fetchProducts } from '@/lib/store-api';
import { ProductRail } from '@/components/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useStoreConfig } from '@/hooks/useStoreData';
import { tiersFrom } from '@/lib/delivery';
import type { StoreProduct } from '@/types';

/**
 * What the store is actually offering today.
 *
 * The prototype had three promo codes — SWIFT50, FRESH10, FREEDEL — with no
 * redemption endpoint behind any of them. There is no promotions system in this
 * API, so printing a code a customer could type at checkout would be a promise
 * the store cannot keep.
 *
 * Every claim below is read from `/api/store/config` or from real
 * `discount_percent` values on real products. That is a shorter page than the
 * prototype's, and every line of it is true.
 */

const CATALOGUE_LIMIT = 120;

export function OffersPage() {
  const config = useStoreConfig();
  const [discounted, setDiscounted] = useState<StoreProduct[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchProducts({ limit: CATALOGUE_LIMIT }, controller.signal)
      .then((products) =>
        setDiscounted(
          products
            .filter((product) => product.in_stock && product.discount_percent > 0)
            .sort((a, b) => b.discount_percent - a.discount_percent),
        ),
      )
      .catch(() => setDiscounted([]));

    return () => controller.abort();
  }, []);

  const tiers = tiersFrom(config);

  return (
    <>
      <div className="container-page py-10 lg:py-16">
        <h1 className="text-3xl font-semibold lg:text-5xl">Offers</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          No codes to remember. Everything here is applied automatically when you check out.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {config ? (
            <>
              <OfferCard
                icon={<PackageCheck className="size-5 text-amber" aria-hidden />}
                title={`Free delivery over ${formatMoney(config.free_delivery_above)}`}
                body="Reach the threshold and the delivery fee comes off your bill at checkout. Nothing to enter."
              />
              {tiers.map((tier) => (
                <OfferCard
                  key={tier.key}
                  icon={<Zap className="size-5 text-amber" aria-hidden />}
                  title={`${tier.label} · about ${tier.promise_minutes} min`}
                  body={
                    tier.fee === 0
                      ? 'Delivered on this speed at no extra charge.'
                      : `${formatMoney(tier.fee)} delivery, or free once your basket passes the threshold.`
                  }
                />
              ))}
            </>
          ) : (
            Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-44 rounded-4xl" />
            ))
          )}
        </div>

        {config && (
          <div className="mt-10 flex flex-col items-start justify-between gap-6 rounded-4xl bg-primary p-10 text-primary-foreground sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-semibold lg:text-3xl">
                Orders start at {formatMoney(config.min_order_value)}.
              </h2>
              <p className="mt-2 max-w-lg text-primary-foreground/70">
                A {formatMoney(config.handling_fee)} handling fee applies to every order, shown on
                your bill before you confirm.
              </p>
            </div>
            <Link
              href="/products"
              className="inline-flex h-13 shrink-0 items-center gap-2 rounded-full bg-amber px-8 text-base font-semibold text-amber-foreground transition-transform duration-300 ease-[var(--ease-apple)] hover:-translate-y-0.5"
            >
              Shop now
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        )}
      </div>

      {discounted && discounted.length > 0 && (
        <ProductRail
          accent
          title="Reduced today"
          subtitle="Every item here is below its MRP right now"
          items={discounted}
          href="/products"
          promiseMinutes={config?.promise_minutes ?? null}
        />
      )}

      {discounted?.length === 0 && (
        <div className="container-page pb-16">
          <div className="flex items-center gap-3 rounded-4xl border border-border/70 p-6">
            <Tag className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Nothing is discounted below MRP at the moment. The delivery offers above still apply.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function OfferCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-4xl border border-border/70 p-6 transition-all duration-300 ease-[var(--ease-apple)] hover:-translate-y-0.5 hover:shadow-card">
      <span className="grid size-11 place-items-center rounded-2xl bg-amber-soft">{icon}</span>
      <h2 className="mt-4 text-[17px] font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
