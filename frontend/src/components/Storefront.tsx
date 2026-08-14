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
import type {
  BasketQuote,
  DeliveryType,
  StoreCategory,
  StoreConfig,
  StoreProduct,
  UnavailableItem,
} from '@/types';
import { DEFAULT_DELIVERY_TYPE, quoteSignature as buildQuoteSignature } from '@/lib/delivery';
import CartDrawer from './store/CartDrawer';
import CategoryRail from './store/CategoryRail';
import CheckoutSheet from './store/CheckoutSheet';
import ProductCard from './store/ProductCard';
import RecentOrders from './store/RecentOrders';
import StoreHeader from './store/StoreHeader';

/** Long enough that typing "tomato" is one request, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Rows per page, matching the backend's STORE_PAGE_SIZE default.
 *
 * "Load more" raises the limit and refetches rather than appending a second
 * page. Slightly more bytes, but it cannot produce duplicates or gaps when the
 * catalogue changes between requests — and a grocery catalogue is a few hundred
 * rows, not a feed.
 */
const PAGE_SIZE = 60;

export default function Storefront() {
  const router = useRouter();
  const cart = useCart();

  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [categories, setCategories] = useState<StoreCategory[]>([]);

  /**
   * Which delivery speed the customer is buying.
   *
   * Seeded from the module constant rather than synced from
   * `config.default_delivery_type` in an effect: that would be a synchronous
   * setState inside an effect (an error under `react-hooks/set-state-in-effect`,
   * and the whole reason the catalogue below is tagged rather than flagged), and
   * it would change the tier under a customer who had already chosen one. Both
   * defaults are `instant`; if they ever diverge the server still decides at
   * checkout.
   */
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(DEFAULT_DELIVERY_TYPE);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [limit, setLimit] = useState(PAGE_SIZE);
  /** Bumped by the retry button to re-run the catalogue effect. */
  const [reloadToken, setReloadToken] = useState(0);

  // Changing what is being browsed resets paging. Done in the handlers rather
  // than an effect so no state is set synchronously during one.
  const changeSearch = (value: string) => {
    setSearch(value);
    setLimit(PAGE_SIZE);
  };

  const changeCategory = (value: string) => {
    setCategory(value);
    setLimit(PAGE_SIZE);
  };

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
    error: string;
  } | null>(null);
  /** Bumped to force a re-quote when the basket itself has not changed. */
  const [quoteReloadToken, setQuoteReloadToken] = useState(0);

  /**
   * Items a *checkout attempt* rejected, tagged with the basket they were
   * rejected for.
   *
   * A 409 from checkout carries the list of items that ran out between quoting
   * and paying. The basket has not changed, so nothing else would re-derive it,
   * and without keeping it here the customer is bounced back to a cart with
   * nothing marked and no idea which row to fix. Tagging with the signature
   * means it clears itself the moment they change anything.
   */
  const [checkoutBlockers, setCheckoutBlockers] = useState<{
    signature: string;
    items: UnavailableItem[];
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
  const query = `${category}::${debouncedSearch}::${limit}::${reloadToken}`;

  useEffect(() => {
    const controller = new AbortController();

    fetchProducts({ q: debouncedSearch, category, limit }, controller.signal)
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
  }, [query, debouncedSearch, category, limit]);

  const products = catalogue?.products ?? [];
  // A full page means the server had at least this many matches, so there may
  // be more behind it. Without this the store silently showed only the first
  // page while the header reported that count as if it were the whole aisle.
  const hasMore = catalogue !== null && catalogue.products?.length === limit;
  const loadError = catalogue?.query === query ? catalogue.error : '';
  // Never loaded anything yet, so there is nothing to show but skeletons.
  const isFirstLoad = catalogue === null;
  // Loaded, but for a different query — the list on screen is one keystroke old.
  const isStale = !isFirstLoad && catalogue.query !== query;

  // --- the bill, always from the server ---------------------------------
  /**
   * Two signatures, and they are not interchangeable.
   *
   * `lineSignature` is what is IN the basket. `quoteSignature` is what the
   * basket was PRICED at, which includes the delivery tier — switching speed
   * changes the bill without changing a single line, so a quote keyed on the
   * lines alone would leave the instant price sitting under a slow selection.
   *
   * `checkoutBlockers` below stays tagged with `lineSignature` on purpose. A
   * 409 says "this item ran out", and that does not stop being true because the
   * customer picked a different delivery speed; re-tagging it with the tier
   * would clear exactly the rows the drawer needs to keep marked.
   */
  const lineSignature = useMemo(
    () => cart.lines.map((line) => `${line.product.id}:${line.quantity}`).join(','),
    [cart.lines],
  );
  const quoteSignature = useMemo(
    () => buildQuoteSignature(cart.lines, deliveryType),
    [cart.lines, deliveryType],
  );

  useEffect(() => {
    if (!cart.isReady || lineSignature === '') return;

    const controller = new AbortController();

    // Aborting on change is what drops a response that arrives after the
    // basket was edited again — without it the drawer can show the total for a
    // cart the customer has already changed. It covers the tier the same way:
    // a fast instant → slow → instant tap aborts the middle request rather than
    // racing it.
    quoteBasket(cart.lines, deliveryType, controller.signal)
      .then((result) =>
        setQuoteResult({ signature: quoteSignature, quote: result, error: '' }),
      )
      .catch((error: unknown) => {
        // An abort is the basket being edited again, not a failure — recording
        // it would show the customer an error they caused by typing.
        if (controller.signal.aborted) return;
        // The failure has to be *recorded against this signature*, not
        // swallowed. `isQuoting` is derived from the signature matching, so
        // leaving the old one in place left the drawer saying "Updating…"
        // forever, with the checkout button disabled and no way out.
        //
        // `quote: null` rather than keeping the last one. The previous quote
        // priced a *different basket*, so showing it under this one would put a
        // total on screen that the customer will not be charged — and worse,
        // `canCheckout` would go true and let them proceed on it. Dropping it
        // falls back to the drawer's existing no-quote state, which already
        // shows the fee rows as "—" and labels the figure "Items" instead of
        // "To pay" precisely so it cannot be read as a bill.
        setQuoteResult({
          signature: quoteSignature,
          quote: null,
          error:
            error instanceof Error
              ? error.message
              : 'Could not price your basket right now.',
        });
      });

    return () => controller.abort();
    // `cart.lines` is intentionally not a dependency: `quoteSignature` is its
    // value-identity plus the tier, and depending on the array would re-quote on
    // every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteSignature, cart.isReady, quoteReloadToken]);

  const quote = cart.count > 0 ? (quoteResult?.quote ?? null) : null;
  const isQuoting = cart.count > 0 && quoteResult?.signature !== quoteSignature;
  // Same shape as `loadError` above: only surface the error if it belongs to
  // the basket and tier currently on screen.
  const quoteError =
    cart.count > 0 && quoteResult?.signature === quoteSignature
      ? quoteResult.error
      : '';

  // Only relevant while the basket is still the one checkout rejected.
  const blockedItems =
    checkoutBlockers?.signature === lineSignature ? checkoutBlockers.items : [];

  const openCart = () => setCartOpen(true);

  const showEmptyState = !isFirstLoad && !loadError && products.length === 0;

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-surface-sunken)]">
      <StoreHeader
        config={config}
        search={search}
        onSearchChange={changeSearch}
        cartCount={cart.count}
        cartSubtotal={
          // items_total, not grand_total: this and `cart.subtotal` must be the
          // same quantity, or the number jumps by the fees the moment the quote
          // lands with nothing on screen explaining why. Fees belong in the
          // drawer, where they are itemised.
          quote?.items_total ?? cart.subtotal
        }
        onOpenCart={openCart}
        onOpenAdmin={() => router.push('/admin')}
      />

      <CategoryRail categories={categories} selected={category} onSelect={changeCategory} />

      {/* The skip link in layout.tsx targets this. `tabIndex={-1}` makes it a
          valid focus destination without adding a tab stop of its own. */}
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 pb-28 sm:px-6 lg:px-8 focus:outline-none"
      >
        {/* Above the grid, and only for someone who has ordered here before:
            for them the whole catalogue is usually the long way round. Renders
            nothing when there is no history, so a first-time visitor sees the
            store exactly as before. */}
        {!debouncedSearch && category === 'All' && <RecentOrders />}

        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-extrabold">
            {debouncedSearch
              ? `Results for “${debouncedSearch}”`
              : category === 'All'
                ? 'Everything in store'
                : category}
          </h1>
          {/* The previous results stay on screen while the next query is in
              flight — replacing them with skeletons on every keystroke is more
              flicker than information. This says the list is one step behind.

              `aria-live` on the wrapper rather than on either branch, so the
              region exists before the text changes: a live region announced
              only from the moment it is inserted announces nothing. Searching
              used to swap the whole grid in silence, which for a screen-reader
              user is a page that simply stops responding. */}
          <span aria-live="polite" aria-atomic="true">
            {isStale ? (
              <span className="text-xs text-[var(--color-ink-faint)]">Updating…</span>
            ) : (
              !isFirstLoad &&
              products.length > 0 && (
                <span className="text-sm text-[var(--color-ink-faint)]">
                  {/* "60+" rather than "60" when the page is full: the count is
                      what was fetched, not what exists, and stating it flatly
                      would be a quiet lie about the size of the aisle. */}
                  {products.length}
                  {hasMore ? '+' : ''} item{products.length === 1 ? '' : 's'}
                </span>
              )
            )}
          </span>
        </div>

        {loadError && (
          <div className="card p-6 text-center">
            <p className="font-semibold text-[var(--color-danger-600)]">{loadError}</p>
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
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
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
            <PackageSearch className="h-10 w-10 text-[var(--color-ink-faint)]" aria-hidden />
            <p className="text-lg font-semibold">Nothing here yet</p>
            <p className="max-w-sm text-base text-[var(--color-ink-faint)]">
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
          <>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {hasMore && (
              <div className="mt-5 text-center">
                <button
                  type="button"
                  disabled={isStale}
                  onClick={() => setLimit((current) => current + PAGE_SIZE)}
                  className="btn-ghost"
                >
                  {isStale ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* The persistent basket bar. On a phone this is the only cart affordance
          that is always in reach, so it stays fixed rather than scrolling with
          the grid. */}
      {cart.count > 0 && !isCartOpen && !isCheckoutOpen && (
        /* The safe-area inset is what keeps the bar clear of the iOS home
           indicator — without it the bottom third of a 56px tap target sits
           under the swipe-up gesture area on every notched iPhone. */
        <div className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={openCart}
            className="mx-auto flex min-h-[3.5rem] w-full max-w-2xl items-center justify-between gap-3 rounded-2xl bg-[var(--color-brand-500)] px-4 py-3 text-[var(--color-navy-900)] shadow-[var(--shadow-lg)] transition-colors duration-300 ease-glide hover:bg-[var(--color-brand-600)]"
          >
            <span className="flex min-w-0 items-center gap-2 text-base font-bold">
              <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden />
              <span className="truncate">
                {cart.count} item{cart.count === 1 ? '' : 's'}
              </span>
              <span className="text-[var(--color-navy-900)]/50">·</span>
              <span className="tabular-nums">
                {/* Matches the header pill — see the note on cartSubtotal. */}
                {formatMoney(quote?.items_total ?? cart.subtotal)}
              </span>
            </span>
            <span className="shrink-0 text-base font-extrabold">View cart →</span>
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
          quoteError={quoteError}
          onRetryQuote={() => setQuoteReloadToken((token) => token + 1)}
          config={config}
          blockedItems={blockedItems}
          deliveryType={deliveryType}
          onDeliveryTypeChange={setDeliveryType}
        />
      )}

      {isCheckoutOpen && (
        <CheckoutSheet
          onClose={() => {
            setCheckoutOpen(false);
            setCartOpen(true);
          }}
          quote={quote}
          config={config}
          deliveryType={deliveryType}
          onUnavailable={(items) => {
            // Send the customer back to the cart — nothing can be fixed from
            // the address form — carrying the list of what actually ran out so
            // the drawer can mark those exact rows. Re-quote too: the basket is
            // unchanged, so nothing else would refresh the totals or the
            // availability the server now reports.
            setCheckoutBlockers({ signature: lineSignature, items });
            setCheckoutOpen(false);
            setCartOpen(true);
            setQuoteReloadToken((token) => token + 1);
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
