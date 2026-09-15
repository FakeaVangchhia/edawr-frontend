'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { slugify } from '@/lib/catalogue';
import { clearRecentSearches, rememberSearch } from '@/lib/recent-searches';
import { fetchCategories, fetchProducts } from '@/lib/store-api';
import { ProductGrid } from '@/components/ProductGrid';
import { usePromiseMinutes, useRecentSearches } from '@/hooks/useStoreData';
import type { StoreCategory, StoreProduct } from '@/types';
import { unlessAborted } from '@/lib/concurrency';

/**
 * The full search results page.
 *
 * Results are tagged with the query that produced them, for the same reason as
 * the overlay: a slow response for a shorter query must not land after a fast
 * one for a longer query and replace correct results with stale ones. The
 * loading flag is derived from that tag rather than stored.
 */

const PAGE_SIZE = 40;

interface Results {
  query: string;
  products: StoreProduct[];
  error: string;
}

export function SearchPage() {
  const router = useRouter();
  const params = useSearchParams();
  const query = (params.get('q') ?? '').trim();

  const recent = useRecentSearches();
  const promiseMinutes = usePromiseMinutes();
  const [draft, setDraft] = useState(query);
  const [results, setResults] = useState<Results | null>(null);
  const [categories, setCategories] = useState<StoreCategory[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCategories(controller.signal)
      .then(unlessAborted(controller.signal, setCategories))
      .catch(() => {
        /* Suggestions are a convenience. */
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!query) return;

    const controller = new AbortController();

    fetchProducts({ q: query, limit: PAGE_SIZE }, controller.signal)
      .then(
        unlessAborted(controller.signal, (products) =>
          setResults({ query, products, error: '' }),
        ),
      )
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setResults({
          query,
          products: [],
          error: caught instanceof Error ? caught.message : 'Search is unavailable right now.',
        });
      });

    return () => controller.abort();
  }, [query]);

  const current = results?.query === query ? results : null;
  const isLoading = query.length > 0 && current === null;

  const submit = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    // Remembered here, at the act of searching, rather than in the effect that
    // fetches: an effect that writes to a store this component also subscribes
    // to costs a render per query, and a term is "recent" because somebody
    // typed it, not because a URL was loaded.
    rememberSearch(trimmed);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="container-page py-8 lg:py-12">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(draft);
        }}
        className="flex items-center gap-3 rounded-full border border-border bg-surface px-5 py-3 transition-colors focus-within:border-primary/25"
      >
        <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search for groceries, snacks, household…"
          aria-label="Search products"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        {draft && (
          <button
            type="button"
            onClick={() => setDraft('')}
            aria-label="Clear search"
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </form>

      {!query ? (
        <div className="mt-10 space-y-8">
          {recent.length > 0 && (
            <section>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent searches
                </h2>
                {/* A shop's phone is often a shared one; what was searched
                    for on it should be the customer's to forget. */}
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  Clear
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {recent.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => submit(term)}
                    className="rounded-full bg-secondary px-4 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </section>
          )}

          {categories.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Browse categories instead
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Link
                    key={category.name}
                    href={`/category/${slugify(category.name)}`}
                    className="rounded-full bg-secondary px-4 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <>
          <h1 className="mt-8 text-2xl font-semibold lg:text-3xl">
            Results for “{query}”
          </h1>
          {current && !current.error && (
            <p className="num mt-2 text-sm text-muted-foreground">
              {current.products.length} {current.products.length === 1 ? 'item' : 'items'}
            </p>
          )}
          {current?.error && <p className="mt-2 text-sm text-destructive">{current.error}</p>}

          <div className="mt-8">
            <ProductGrid
              products={current?.products ?? []}
              isLoading={isLoading}
              promiseMinutes={promiseMinutes}
              emptyTitle={`Nothing matches “${query}”`}
              emptyBody="Try a shorter word, or browse the categories."
            />
          </div>
        </>
      )}
    </div>
  );
}
