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
      className="glass-strong border-b border-[rgba(212,175,55,0.14)]"
    >
      <ul className="no-scrollbar mx-auto flex max-w-7xl gap-2 overflow-x-auto px-3 py-3 sm:px-6">
        {tiles.map((category) => {
          const isSelected = selected === category.name;
          return (
            <li key={category.name} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(category.name)}
                aria-current={isSelected ? 'true' : undefined}
                /* Selection is marked by a filled background and a 2px border,
                   not by colour alone — the same tile has to read as "chosen"
                   to someone who cannot separate purple text from grey. */
                className={`flex w-[5.5rem] flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 transition-colors ${
                  isSelected
                    ? 'border-[var(--color-brand-500)] bg-[rgba(212,175,55,0.14)] shadow-[0_8px_24px_-12px_rgba(212,175,55,0.8)]'
                    : 'border-transparent hover:bg-[rgba(255,250,235,0.05)]'
                }`}
              >
                <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-[rgba(8,7,12,0.55)] text-2xl">
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
                  className={`line-clamp-2 text-center text-xs font-semibold leading-tight ${
                    isSelected ? 'text-[var(--color-brand-700)]' : 'text-[var(--color-ink-soft)]'
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
