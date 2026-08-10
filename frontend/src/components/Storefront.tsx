'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PackageSearch, ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { formatMoney } from '@/lib/format';
import {
  fetchCategories,
  fetchProducts,
  fetchStoreConfig,
  quoteBasket,
} from '@/lib/store-api';
import type { BasketQuote, StoreCategory, StoreConfig, StoreProduct } from '@/types';
import CartDrawer from './store/CartDrawer';
import CategoryRail from './store/CategoryRail';
import CheckoutSheet from './store/CheckoutSheet';
import ProductCard from './store/ProductCard';
import StoreHeader from './store/StoreHeader';

/** Long enough that typing "tomato" is one request, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 250;

export default function Storefront() {
  const router = useRouter();
  const cart = useCart();

  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [categories, setCategories] = useState<StoreCategory[]>([]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('All');
  /** Bumped by the retry button to re-run the catalogue effect. */
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * The catalogue, tagged with the query that produced it.
   *
   * Storing the query alongside the rows is what lets "is this list stale?" be
   * *derived* rather than tracked in a separate loading flag — and a flag would
   * have to be set synchronously inside the effect, which causes a cascading
   * render. Same reasoning for the quote below.
   */
  const [catalogue, setCatalogue] = useState<{
    query: string;
    products: StoreProduct[] | null;
    error: string;
  } | null>(null);

  const [quoteResult, setQuoteResult] = useState<{
    signature: string;
    quote: BasketQuote | null;
  } | null>(null);

  const [isCartOpen, setCartOpen] = useState(false);
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);

  // --- store metadata, fetched once ------------------------------------
  useEffect(() => {
    const controller = new AbortController();

    // Neither of these should be able to break the page: a store with no
    // category rail still sells things, and the header falls back to sensible
    // defaults if the config call fails.
    fetchStoreConfig(controller.signal)
      .then(setConfig)
      .catch(() => undefined);
    fetchCategories(controller.signal)
      .then(setCategories)
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  // --- debounce the search box -----------------------------------------
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  // --- catalogue --------------------------------------------------------
  const query = `${category}::${debouncedSearch}::${reloadToken}`;

  useEffect(() => {
    const controller = new AbortController();

    fetchProducts({ q: debouncedSearch, category }, controller.signal)
      .then((rows) => setCatalogue({ query, products: rows, error: '' }))
      .catch((error: unknown) => {
        // An aborted request is not a failure — it means the customer typed
        // another character and this response is already stale.
        if (controller.signal.aborted) return;
        setCatalogue({
          query,
          products: null,
          error:
            error instanceof Error ? error.message : 'Could not load the store right now.',
        });
      });

    return () => controller.abort();
  }, [query, debouncedSearch, category]);

  const products = catalogue?.products ?? [];
  const loadError = catalogue?.query === query ? catalogue.error : '';
  // Never loaded anything yet, so there is nothing to show but skeletons.
  const isFirstLoad = catalogue === null;
  // Loaded, but for a different query — the list on screen is one keystroke old.
  const isStale = !isFirstLoad && catalogue.query !== query;

  // --- the bill, always from the server ---------------------------------
  const lineSignature = useMemo(
    () => cart.lines.map((line) => `${line.product.id}:${line.quantity}`).join(','),
    [cart.lines],
  );

  useEffect(() => {
    if (!cart.isReady || lineSignature === '') return;

    const controller = new AbortController();

    // Aborting on change is what drops a response that arrives after the
    // basket was edited again — without it the drawer can show the total for a
    // cart the customer has already changed.
    quoteBasket(cart.lines, controller.signal)
      .then((result) => setQuoteResult({ signature: lineSignature, quote: result }))
      .catch(() => {
        // Leave the previous quote on screen. Checkout re-prices server-side
        // anyway, so a failed quote can never let a wrong total be paid.
      });

    return () => controller.abort();
    // `cart.lines` is intentionally not a dependency: `lineSignature` is its
    // value-identity, and depending on the array would re-quote on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineSignature, cart.isReady]);

  const quote = cart.count > 0 ? (quoteResult?.quote ?? null) : null;
  const isQuoting = cart.count > 0 && quoteResult?.signature !== lineSignature;

  const openCart = () => setCartOpen(true);

  const showEmptyState = !isFirstLoad && !loadError && products.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-surface-sunken)]">
      <StoreHeader
        config={config}
        search={search}
        onSearchChange={setSearch}
        cartCount={cart.count}
        cartSubtotal={quote?.grand_total ?? cart.subtotal}
        onOpenCart={openCart}
        onOpenAdmin={() => router.push('/admin')}
      />

      <CategoryRail categories={categories} selected={category} onSelect={setCategory} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 pb-28 sm:px-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h1 className="text-lg font-extrabold">
            {debouncedSearch
              ? `Results for “${debouncedSearch}”`
              : category === 'All'
                ? 'Everything in store'
                : category}
          </h1>
          {/* The previous results stay on screen while the next query is in
              flight — replacing them with skeletons on every keystroke is more
              flicker than information. This says the list is one step behind. */}
          {isStale ? (
            <span className="text-xs text-[var(--color-ink-faint)]">Updating…</span>
          ) : (
            !isFirstLoad &&
            products.length > 0 && (
              <span className="text-xs text-[var(--color-ink-faint)]">
                {products.length} item{products.length === 1 ? '' : 's'}
              </span>
            )
          )}
        </div>

        {loadError && (
          <div className="card p-6 text-center">
            <p className="font-semibold text-[#b91c1c]">{loadError}</p>
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className="btn-ghost mt-3"
            >
              Try again
            </button>
          </div>
        )}

        {isFirstLoad && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="card overflow-hidden p-2.5">
                <div className="skeleton mb-2 aspect-square rounded-xl" />
                <div className="skeleton mb-1.5 h-3 w-4/5 rounded" />
                <div className="skeleton h-3 w-2/5 rounded" />
              </div>
            ))}
          </div>
        )}

        {showEmptyState && (
          <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
            <PackageSearch className="h-9 w-9 text-[var(--color-ink-faint)]" aria-hidden />
            <p className="font-semibold">Nothing here yet</p>
            <p className="max-w-sm text-sm text-[var(--color-ink-faint)]">
              {debouncedSearch
                ? `We could not find anything matching “${debouncedSearch}”.`
                : 'This aisle is empty right now. Try another category.'}
            </p>
            {(debouncedSearch || category !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCategory('All');
                }}
                className="btn-ghost mt-2"
              >
                Show everything
              </button>
            )}
          </div>
        )}

        {!isFirstLoad && products.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>

      {/* The persistent basket bar. On a phone this is the only cart affordance
          that is always in reach, so it stays fixed rather than scrolling with
          the grid. */}
      {cart.count > 0 && !isCartOpen && !isCheckoutOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3">
          <button
            type="button"
            onClick={openCart}
            className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-2xl bg-[var(--color-brand-700)] px-4 py-3 text-white shadow-[0_16px_40px_-16px_rgba(46,16,101,0.8)] transition-colors hover:bg-[var(--color-brand-900)]"
          >
            <span className="flex items-center gap-2 text-sm font-bold">
              <ShoppingCart className="h-4 w-4" aria-hidden />
              {cart.count} item{cart.count === 1 ? '' : 's'}
              <span className="text-white/60">·</span>
              <span className="tabular-nums">
                {formatMoney(quote?.grand_total ?? cart.subtotal)}
              </span>
            </span>
            <span className="text-sm font-extrabold">View cart →</span>
          </button>
        </div>
      )}

      {/* Mounted only while open, so each one starts from a clean slate —
          a half-typed address or a stale error should not survive a close. */}
      {isCartOpen && (
        <CartDrawer
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false);
            setCheckoutOpen(true);
          }}
          quote={quote}
          isQuoting={isQuoting}
          config={config}
        />
      )}

      {isCheckoutOpen && (
        <CheckoutSheet
          onClose={() => {
            setCheckoutOpen(false);
            setCartOpen(true);
          }}
          quote={quote}
          onUnavailable={() => {
            // Send the customer back to the cart — nothing can be fixed from
            // the address form. The quote re-runs automatically once they
            // change a quantity, and the drawer marks the offending rows from
            // the `unavailable` list the 409 carried.
            setCheckoutOpen(false);
            setCartOpen(true);
            setReloadToken((token) => token + 1);
          }}
          onPlaced={(order) => {
            setCheckoutOpen(false);
            router.push(`/order/${order.tracking_token}`);
          }}
        />
      )}
    </div>
  );
}
