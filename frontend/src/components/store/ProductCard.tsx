'use client';

/* eslint-disable @next/next/no-img-element -- Product images are served by the
   Django backend at a host that is only known at runtime (NEXT_PUBLIC_API_URL),
   so next/image's remotePatterns cannot be configured at build time without
   baking the hostname in — which is the one thing `assetUrl` exists to avoid.
   Lazy loading and async decoding are set explicitly below. Revisit if the
   images move to a fixed CDN origin. */

import { ImageOff } from 'lucide-react';
import { assetUrl } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { formatMoney } from '@/lib/format';
import type { StoreProduct } from '@/types';
import QuantityStepper from './QuantityStepper';

export default function ProductCard({ product }: { product: StoreProduct }) {
  const { quantityOf, add, setQuantity } = useCart();
  const quantity = quantityOf(product.id);

  // Only claim a discount when there is a real one. An `mrp` that equals the
  // price would otherwise render a struck-out identical number and a "0% OFF"
  // badge, which reads as broken rather than generous.
  const hasDiscount = product.discount_percent > 0 && product.mrp > product.price;

  return (
    <article className="card group relative flex flex-col overflow-hidden p-2.5 transition-shadow hover:shadow-[0_10px_30px_-18px_rgba(46,16,101,0.45)]">
      <div className="relative mb-2 aspect-square overflow-hidden rounded-xl bg-[var(--color-surface-sunken)]">
        {product.image_url ? (
          <img
            src={assetUrl(product.image_url)}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--color-ink-faint)]">
            <ImageOff className="h-7 w-7" aria-hidden />
          </div>
        )}

        {hasDiscount && (
          <span className="badge-discount absolute left-1.5 top-1.5">
            {product.discount_percent}%
            <br />
            OFF
          </span>
        )}

        {!product.in_stock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75">
            <span className="rounded-md bg-[var(--color-ink)] px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-white">
              Out of stock
            </span>
          </div>
        )}
      </div>

      {product.low_stock && product.in_stock && (
        <span className="mb-1 text-[0.68rem] font-bold uppercase tracking-wide text-[#c2410c]">
          Only a few left
        </span>
      )}

      <h3 className="line-clamp-2 text-[0.85rem] font-semibold leading-snug text-[var(--color-ink)]">
        {product.name}
      </h3>
      <p className="mt-0.5 text-[0.75rem] text-[var(--color-ink-faint)]">{product.unit}</p>

      <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
        <div className="min-w-0">
          <div className="text-[0.95rem] font-extrabold leading-tight text-[var(--color-ink)]">
            {formatMoney(product.price)}
          </div>
          {hasDiscount && (
            <div className="text-[0.72rem] text-[var(--color-ink-faint)] line-through">
              {formatMoney(product.mrp)}
            </div>
          )}
        </div>

        <div className="w-[4.5rem] shrink-0">
          {quantity > 0 ? (
            <QuantityStepper
              compact
              quantity={quantity}
              label={product.name}
              onChange={(next) => setQuantity(product, next)}
            />
          ) : (
            <button
              type="button"
              className="btn-add"
              disabled={!product.in_stock}
              onClick={() => add(product)}
            >
              {product.in_stock ? 'Add' : '—'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
