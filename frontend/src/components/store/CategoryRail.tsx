'use client';

/* eslint-disable @next/next/no-img-element -- see ProductCard.tsx */

import { assetUrl } from '@/lib/api';
import type { StoreCategory } from '@/types';

/**
 * Emoji stand-ins for categories that have no uploaded tile image.
 *
 * A grid of identical grey placeholders is worse than no rail at all, and a
 * new store has no images on day one. Matching is a substring test on the
 * lower-cased name because `Product.category` is free text — "Dairy & Bread"
 * and "dairy" should land on the same icon.
 */
const FALLBACK_ICONS: Array<[string, string]> = [
  ['fruit', '🥬'],
  ['veget', '🥦'],
  ['dairy', '🥛'],
  ['bread', '🍞'],
  ['snack', '🍿'],
  ['munch', '🍪'],
  ['drink', '🥤'],
  ['juice', '🧃'],
  ['cold', '🧊'],
  ['instant', '🍜'],
  ['frozen', '🧊'],
  ['staple', '🌾'],
  ['rice', '🍚'],
  ['personal', '🧴'],
  ['care', '🧼'],
  ['household', '🧹'],
  ['clean', '🧽'],
  ['baby', '🍼'],
  ['pet', '🐾'],
];

function iconFor(name: string): string {
  const key = name.toLowerCase();
  return FALLBACK_ICONS.find(([needle]) => key.includes(needle))?.[1] ?? '🛒';
}

interface CategoryRailProps {
  categories: StoreCategory[];
  selected: string;
  onSelect: (category: string) => void;
}

export default function CategoryRail({ categories, selected, onSelect }: CategoryRailProps) {
  if (categories.length === 0) return null;

  // `Product.category` is free text, so a store really can create a category
  // called "All". Without this filter that produces two tiles with the same
  // React key, both rendered as selected, and picking it filters nothing —
  // the backend treats `category=all` as "no filter".
  const realCategories = categories.filter(
    (category) => category.name.trim().toLowerCase() !== 'all',
  );
  const tiles = [{ name: 'All', image_url: null, product_count: 0 }, ...realCategories];

  return (
    <nav
      aria-label="Product categories"
      className="bg-[var(--color-surface)]"
    >
      <ul className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 py-3 sm:gap-2 sm:px-5 lg:px-7">
        {tiles.map((category) => {
          const isSelected = selected === category.name;
          return (
            <li key={category.name} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(category.name)}
                aria-current={isSelected ? 'true' : undefined}
                /* Selection is a filled tile plus a bolder, darker label — two
                   signals, neither of them an outline. The same tile has to
                   read as "chosen" to someone who cannot separate bronze text
                   from grey, which the fill handles on its own. */
                className={`flex w-[4.75rem] flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-colors sm:w-[5.5rem] sm:px-1.5 ${
                  isSelected
                    ? 'bg-[var(--color-brand-50)]'
                    : 'hover:bg-[var(--color-surface-sunken)]'
                }`}
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl text-2xl transition-colors sm:h-14 sm:w-14 ${
                    isSelected
                      ? 'bg-[var(--color-brand-200)]'
                      : 'bg-[var(--color-surface-inset)]'
                  }`}
                >
                  {category.image_url ? (
                    <img
                      src={assetUrl(category.image_url)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span aria-hidden>{category.name === 'All' ? '🛍️' : iconFor(category.name)}</span>
                  )}
                </span>
                <span
                  className={`line-clamp-2 text-center text-xs leading-tight ${
                    isSelected
                      ? 'font-extrabold text-[var(--color-brand-700)]'
                      : 'font-semibold text-[var(--color-ink-soft)]'
                  }`}
                >
                  {category.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
