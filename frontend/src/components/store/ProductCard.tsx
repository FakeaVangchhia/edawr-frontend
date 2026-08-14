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
import { useTilt } from '@/hooks/useTilt';
import type { StoreProduct } from '@/types';
import QuantityStepper from './QuantityStepper';

export default function ProductCard({ product }: { product: StoreProduct }) {
  const { quantityOf, add, setQuantity } = useCart();
  const quantity = quantityOf(product.id);
  // Pointer-only, and off under reduced motion — see the hook.
  const tiltRef = useTilt<HTMLElement>();

  // Only claim a discount when there is a real one. An `mrp` that equals the
  // price would otherwise render a struck-out identical number and a "0% OFF"
  // badge, which reads as broken rather than generous.
  const hasDiscount = product.discount_percent > 0 && product.mrp > product.price;

  return (
    <article
      ref={tiltRef}
      className="card tilt-3d group relative flex flex-col overflow-hidden p-3"
    >
      {/* Lifted toward the viewer inside the tilted card. The parallax between
          this and the flat text below is what reads as depth rather than as a
          skew. */}
      <div className="tilt-layer relative mb-2.5 aspect-square overflow-hidden rounded-2xl bg-[var(--color-surface-inset)]">
        {product.image_url ? (
          <img
            src={assetUrl(product.image_url)}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="ease-glide h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--color-ink-faint)]">
            <ImageOff className="h-8 w-8" aria-hidden />
          </div>
        )}

        {hasDiscount && (
          <span className="badge-discount absolute left-2 top-2">
            {product.discount_percent}% off
          </span>
        )}

        {!product.in_stock && (
          // A LIGHT scrim, which is the inverse of what this was. The argument
          // has not changed — the scrim should be the quiet choice, not a flash
          // announcing the one product that cannot be bought — but on a white
          // tile it is the dark scrim that shouts and the light one that
          // recedes. The chip's red border is what carries the state.
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(255,255,255,0.8)] backdrop-blur-[2px]">
            <span className="rounded-xl bg-[var(--color-danger-600)] px-2.5 py-1.5 text-sm font-bold text-white shadow-[var(--shadow-sm)]">
              Out of stock
            </span>
          </div>
        )}
      </div>

      {product.low_stock && product.in_stock && (
        // The bronze amber, not the brand amber: #F5A623 on white is 2:1, and
        // this line is the whole warning.
        <span className="mb-1 text-xs font-bold text-[var(--color-brand-700)]">
          Only a few left
        </span>
      )}

      <h3 className="line-clamp-2 text-base font-semibold leading-snug text-[var(--color-ink)]">
        {product.name}
      </h3>
      <p className="mt-0.5 text-sm text-[var(--color-ink-faint)]">{product.unit}</p>

      {/* Price above the button, each on its own full-width row.
          Previously the price and the Add control shared a row, which left the
          button a 72px column — too narrow to hold two 44px tap targets once
          it becomes a stepper, and it squeezed the price into 15px type. The
          price is the number the customer decides on, so it gets the largest
          text on the tile; the button gets the full width, which is the
          easiest possible target to hit. */}
      <div className="mt-auto pt-2.5">
        <div className="mb-2 flex items-baseline gap-2">
          {/* Navy, and the largest thing on the tile. The price is what the
              customer is actually deciding on, and size is a stronger
              hierarchy signal than hue — a grid of bronze prices reads muddy,
              while a grid of large navy ones reads as a price list. The amber
              on this tile belongs to the Add button. */}
          <span className="text-xl font-extrabold leading-none text-[var(--color-ink)]">
            {formatMoney(product.price)}
          </span>
          {hasDiscount && (
            <span className="text-sm text-[var(--color-ink-faint)] line-through">
              {formatMoney(product.mrp)}
            </span>
          )}
        </div>

        {quantity > 0 ? (
          <QuantityStepper
            quantity={quantity}
            label={product.name}
            // An item already in the basket that has since sold out must not
            // be increasable. The disabled Add button below never applies to
            // it, because the stepper has replaced that button entirely.
            canIncrease={product.in_stock}
            onChange={(next) => setQuantity(product, next)}
          />
        ) : (
          <button
            type="button"
            className="btn-add"
            disabled={!product.in_stock}
            onClick={() => add(product)}
          >
            {product.in_stock ? 'Add' : 'Unavailable'}
          </button>
        )}
      </div>
    </article>
  );
}
