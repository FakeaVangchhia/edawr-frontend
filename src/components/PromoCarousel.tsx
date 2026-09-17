'use client';

/* eslint-disable @next/next/no-img-element -- Banner images come from the same
   media host as product images, known only at runtime. See HomePage.tsx. */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { assetUrl } from '@/lib/api';
import { promoDestination } from '@/lib/promo-link';
import { cn } from '@/lib/utils';
import type { StorePromo } from '@/types';

/**
 * The banners at the top of the home page.
 *
 * Content comes from `/api/store/promos`, which the console manages and which
 * already applies each banner's window — this component never decides what is
 * live, only how it scrolls. It is a horizontal snap rail rather than an
 * auto-advancing slideshow: a carousel that moves on its own moves the tap
 * target out from under a thumb, and on a page whose whole promise is speed a
 * customer should not have to wait for the slide they wanted to come round.
 *
 * **The list arrives as a prop, fetched on the server by `app/page.tsx`.**
 * Fetching in the browser and reserving space with a skeleton is right for a
 * rail that always has content and wrong for one that is usually empty: a
 * store with no banners — every store on day one — would get a band that
 * painted and then collapsed on every visit, shoving the category cards up by
 * its own height. Server-rendering it means the HTML already knows whether
 * there is anything to show, so there is no loading state to reserve space
 * for, and a crawler sees the banners too.
 *
 * Renders nothing at all for an empty list; an empty band is worse than none.
 * Dots appear only when there is more than one banner, and arrows only on
 * desktop, where there is no thumb to swipe with. The active dot is derived
 * from `IntersectionObserver` on the cards rather than from scroll
 * arithmetic, so it stays right when a card's width changes with the viewport.
 */
export function PromoCarousel({ promos }: { promos: StorePromo[] }) {
  const [active, setActive] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || promos.length < 2) return;
    const cards = Array.from(rail.children) as HTMLElement[];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(cards.indexOf(entry.target as HTMLElement));
          }
        }
      },
      { root: rail, threshold: 0.6 },
    );
    for (const card of cards) observer.observe(card);
    return () => observer.disconnect();
  }, [promos]);

  if (promos.length === 0) return null;

  const scrollTo = (index: number) => {
    const rail = railRef.current;
    const card = rail?.children[index] as HTMLElement | undefined;
    if (!rail || !card) return;
    rail.scrollTo({ left: card.offsetLeft - rail.offsetLeft, behavior: 'smooth' });
  };

  const many = promos.length > 1;

  return (
    <section aria-label="Promotions" className="container-page relative">
      <div
        ref={railRef}
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 lg:mx-0 lg:px-0"
      >
        {promos.map((promo, index) => (
          <PromoCard key={promo.id} promo={promo} priority={index === 0} />
        ))}
      </div>

      {many && (
        <>
          {/* Dots: the position, and a way to jump. */}
          <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="Choose a banner">
            {promos.map((promo, index) => (
              <button
                key={promo.id}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-label={promo.title}
                onClick={() => scrollTo(index)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300 ease-[var(--ease-apple)]',
                  index === active ? 'w-6 bg-primary' : 'w-1.5 bg-border hover:bg-muted-foreground/40',
                )}
              />
            ))}
          </div>

          {/* Arrows, desktop only: a pointer cannot swipe. */}
          <button
            type="button"
            aria-label="Previous banner"
            onClick={() => scrollTo(Math.max(0, active - 1))}
            className="absolute left-2 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-background/90 shadow-card backdrop-blur transition-transform hover:scale-105 lg:grid"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next banner"
            onClick={() => scrollTo(Math.min(promos.length - 1, active + 1))}
            className="absolute right-2 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-background/90 shadow-card backdrop-blur transition-transform hover:scale-105 lg:grid"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </>
      )}
    </section>
  );
}

/**
 * One banner. The whole card is the link; the copy sits on a navy gradient so
 * it reads over any photograph — and, with no photograph, on navy itself.
 */
function PromoCard({ promo, priority }: { promo: StorePromo; priority: boolean }) {
  const image = assetUrl(promo.image_url);
  const destination = promoDestination(promo.link);
  const className =
    'group relative block w-full shrink-0 snap-start overflow-hidden rounded-4xl bg-primary text-primary-foreground transition-all duration-400 ease-[var(--ease-apple)] hover:-translate-y-0.5 hover:shadow-lift';

  const body = (
    <>
      <div className="aspect-[16/7] w-full sm:aspect-[16/5]">
        {image && (
          <img
            src={image}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            width={1600}
            height={600}
            className="size-full object-cover transition-transform duration-500 ease-[var(--ease-apple)] group-hover:scale-[1.03]"
          />
        )}
      </div>
      <div
        className={cn(
          'absolute inset-0 flex flex-col justify-end p-5 sm:p-8',
          image && 'bg-gradient-to-t from-primary/90 via-primary/40 to-transparent',
        )}
      >
        <p className="text-[22px] font-semibold leading-tight sm:text-[32px]">{promo.title}</p>
        {promo.subtitle && (
          <p className="mt-1 max-w-md text-sm text-primary-foreground/75 sm:text-base">
            {promo.subtitle}
          </p>
        )}
        <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13px] font-semibold text-amber-foreground">
          {destination.cta}
          <ArrowRight className="size-3.5" aria-hidden />
        </span>
      </div>
    </>
  );

  // A storefront path is a client-side navigation. Anything else is a real
  // anchor — `next/link` would try to route a `tel:` — and a website gets a
  // new tab with `noopener`, so the page it opens cannot reach back to this
  // one. See lib/promo-link.ts for the split.
  if (!destination.external) {
    return (
      <Link href={destination.href} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <a
      href={destination.href}
      className={className}
      target={destination.newTab ? '_blank' : undefined}
      rel={destination.newTab ? 'noopener noreferrer' : undefined}
    >
      {body}
    </a>
  );
}
