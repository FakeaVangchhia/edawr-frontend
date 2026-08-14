'use client';

/* eslint-disable @next/next/no-img-element -- Product images come from the
   Django backend at a host only known at runtime (NEXT_PUBLIC_API_URL), so
   next/image's remotePatterns cannot be configured at build time without
   baking the hostname in — the one thing assetUrl() exists to avoid. See
   ProductCard.tsx for the same reasoning on the storefront. */

import { useEffect, useMemo, useState } from 'react';
import { Product } from '../types';
import { Box, Edit2, Search, ShieldCheck } from 'lucide-react';
import { assetUrl, authRequest } from '../lib/api';
import { formatMoneyExact } from '../lib/format';

interface ProductsListProps {
  onEditProduct: (id: number | null) => void;
}

/**
 * Three stock states, and only two colours to say them in.
 *
 * Red for out-of-stock and amber for reorder-soon carry real urgency. "Healthy"
 * gets no colour at all — it is the state most rows are in, and colouring the
 * default is what turns a scannable table into a wall of green. The word in the
 * badge is the label either way, so nothing here is carried by hue alone.
 *
 * The amber tier uses `brand-700` (bronze) rather than `brand-500`: the brand
 * amber as text measures about 2:1 on any of these washes.
 */
const stockBadgeClass = (product: Product) => {
  if (product.stock <= 0)
    return 'bg-[var(--color-danger-50)] text-[var(--color-danger-600)]';
  if (product.stock <= product.reorder_level)
    return 'bg-[var(--color-brand-50)] text-[var(--color-brand-700)]';
  return 'bg-[var(--color-ok-50)] text-[var(--color-ok-600)]';
};

const stockLabel = (product: Product) => {
  if (product.stock <= 0) return 'Out of stock';
  if (product.stock <= product.reorder_level) return 'Reorder soon';
  return 'Healthy';
};

/**
 * Margin and inventory valuation are computed here rather than served.
 *
 * This is the one place client-side arithmetic on money is acceptable, and the
 * reason is worth stating: these are *management figures shown to the owner*,
 * never a price quoted to a customer and never anything that becomes a charge.
 * No backend endpoint supplies them. Everything a customer is billed for still
 * comes from `api/pricing.py` in Decimal — see the rule in CLAUDE.md.
 */
const marginPercent = (product: Product) => {
  if (!product.price) return 0;
  return ((product.price - product.cost_price) / product.price) * 100;
};

export default function ProductsList({ onEditProduct }: ProductsListProps) {
  /**
   * One piece of state for the whole fetch, `null` until the first one lands.
   *
   * The loading flag is *derived* from that null rather than tracked
   * separately, because setting a flag at the top of the effect body is a
   * synchronous setState inside an effect — a cascading render, and an error
   * under `react-hooks/set-state-in-effect`. Same shape as `Storefront`.
   */
  const [result, setResult] = useState<{ rows: Product[]; error: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Memoised because the `?? []` would otherwise be a fresh array every render,
  // re-running both useMemos below on every keystroke in the search box.
  const products = useMemo(() => result?.rows ?? [], [result]);
  const isLoading = result === null;
  const loadError = result?.error ?? '';

  useEffect(() => {
    let cancelled = false;

    authRequest<Product[]>('/api/products')
      .then((rows) => {
        if (cancelled) return;
        // Guard the shape, not just the status. A failed request used to put
        // `{"detail": ...}` here, and `.reduce()` below then threw during
        // render and blanked the console — logout button included.
        setResult({ rows: Array.isArray(rows) ? rows : [], error: '' });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setResult({
          rows: [],
          error:
            caught instanceof Error ? caught.message : 'Could not load products.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter(product =>
      [
        product.name,
        product.sku,
        product.barcode,
        product.category,
        product.brand,
        product.location,
        product.supplier_name,
      ].some(value => value?.toLowerCase().includes(query))
    );
  }, [searchQuery, products]);

  const inventoryMetrics = useMemo(() => {
    const totalUnits = products.reduce((sum, product) => sum + (product.stock || 0), 0);
    const lowStockCount = products.filter(product => (product.stock || 0) <= (product.reorder_level || 0)).length;
    const inventoryValue = products.reduce((sum, product) => sum + (Number(product.cost_price || 0) * (product.stock || 0)), 0);
    return {
      totalSkus: products.length,
      totalUnits,
      lowStockCount,
      inventoryValue,
    };
  }, [products]);

  return (
    <div className="space-y-5">
      <div className="card">
        <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-bold">Product registry</h3>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Search, review stock health, inspect suppliers and reopen a SKU for editing.
            </p>
          </div>
          {/* Stacks below `sm`: side by side, the search box and a
              `whitespace-nowrap` "Add product" left about 90px for typing. */}
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:gap-4 lg:max-w-xl">
            <label className="relative block flex-1">
              <span className="sr-only">Search products</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-faint)]"
                aria-hidden
              />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, SKU, category, brand…"
                className="field pl-10"
              />
            </label>
            <button
              type="button"
              onClick={() => onEditProduct(null)}
              className="btn-primary whitespace-nowrap"
            >
              Add product
            </button>
          </div>
        </div>

        {loadError && (
          <div
            role="alert"
            className="px-4 py-3 text-sm font-semibold text-[var(--color-danger-600)] sm:px-6"
          >
            {loadError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:gap-4 sm:px-6 lg:grid-cols-4">
          {[
            { label: 'Total SKUs', value: inventoryMetrics.totalSkus, icon: Box },
            { label: 'Inventory units', value: inventoryMetrics.totalUnits, icon: Box },
            { label: 'Low stock items', value: inventoryMetrics.lowStockCount, icon: ShieldCheck },
            {
              label: 'Inventory value',
              value: formatMoneyExact(inventoryMetrics.inventoryValue),
              icon: Box,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl bg-[var(--color-surface-inset)] p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-faint)]">
                    {label}
                  </p>
                  {/* Steps down on a phone: "₹1,24,500" at 26px in a
                      half-width tile overflowed its own card. */}
                  <p className="mt-1 text-xl font-black tabular-nums sm:text-2xl">{value}</p>
                </div>
                <div className="hidden rounded-xl bg-[var(--color-surface)] p-2 text-[var(--color-ink-soft)] sm:block">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Five columns of inventory detail do not fit a phone, and a table in
            a horizontal scroller is a table nobody scrolls. Below `xl` each row
            becomes a stacked card instead — same cells, same order, laid out
            as blocks. `xl` rather than `lg` because the Pricing sub-table alone
            needs ~260px and an iPad in landscape is 1024. */}
        <div className="overflow-x-auto max-xl:hidden">
          <table className="min-w-full divide-y divide-[var(--color-line)]">
            <thead>
              <tr>
                {['Product', 'Pricing', 'Inventory', 'Operations', 'Action'].map(heading => (
                  <th
                    key={heading}
                    className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-faint)]"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {filteredProducts.map(product => (
                <tr
                  key={product.id}
                  className="align-top hover:bg-[var(--color-surface-sunken)]"
                >
                  <td className="px-6 py-5">
                    <div className="flex gap-3">
                      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl bg-[var(--color-surface-inset)]">
                        {product.image_url ? (
                          <img
                            src={assetUrl(product.image_url)}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[var(--color-ink-faint)]">
                            <Box className="h-5 w-5" aria-hidden />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{product.name}</div>
                        <div className="mt-1 text-xs font-medium uppercase tracking-wider text-[var(--color-ink-faint)]">
                          {product.sku || 'SKU pending'}
                          {product.barcode ? ` • ${product.barcode}` : ''}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {[product.category, product.brand, product.unit]
                            .filter(Boolean)
                            .map((chip, index) => (
                              <span
                                key={`${chip}-${index}`}
                                className="rounded-full bg-[var(--color-surface-sunken)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)]"
                              >
                                {chip}
                              </span>
                            ))}
                        </div>
                        {product.description && (
                          <p className="mt-3 line-clamp-2 max-w-xs text-sm text-[var(--color-ink-faint)]">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-[var(--color-ink-soft)]">
                    <div className="space-y-1.5 tabular-nums">
                      <div className="flex justify-between gap-6">
                        <span>Selling</span>
                        <span className="font-semibold text-[var(--color-ink)]">
                          {formatMoneyExact(product.price)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-6">
                        <span>Cost</span>
                        <span>{formatMoneyExact(product.cost_price)}</span>
                      </div>
                      <div className="flex justify-between gap-6">
                        <span>MRP</span>
                        <span>{formatMoneyExact(product.mrp)}</span>
                      </div>
                      <div className="flex justify-between gap-6">
                        <span>Margin</span>
                        <span className="font-semibold text-[var(--color-ink)]">
                          {marginPercent(product).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-[var(--color-ink-soft)]">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-6">
                        <span>On hand</span>
                        <span className="font-semibold tabular-nums text-[var(--color-ink)]">
                          {product.stock}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-6">
                        <span>Reorder</span>
                        <span className="font-semibold tabular-nums text-[var(--color-ink)]">
                          {product.reorder_level}
                        </span>
                      </div>
                      <div className="pt-1">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stockBadgeClass(product)}`}
                        >
                          {stockLabel(product)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-[var(--color-ink-soft)]">
                    <div className="space-y-2">
                      <div className="font-semibold text-[var(--color-ink)]">
                        {product.status}
                      </div>
                      <div>{product.location || 'Location not set'}</div>
                      <div>{product.supplier_name || 'Supplier not set'}</div>
                      {product.supplier_phone && <div>{product.supplier_phone}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <button
                      type="button"
                      onClick={() => onEditProduct(product.id)}
                      className="btn-ghost flex items-center gap-2"
                    >
                      <Edit2 className="h-4 w-4" aria-hidden /> Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-sm text-[var(--color-ink-faint)]"
                  >
                    {/* "Loading" and "none exist" are different facts. Saying
                        the second while the first is true is how a manager on a
                        slow connection concludes the catalogue is gone. */}
                    {isLoading
                      ? 'Loading products…'
                      : searchQuery
                        ? 'No products match that search.'
                        : 'No products yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* The same rows, stacked, for anything narrower than `xl`. */}
        <ul className="divide-y divide-[var(--color-line)] xl:hidden">
          {filteredProducts.map(product => (
            <li key={product.id} className="px-4 py-4 sm:px-6">
              <div className="flex gap-3">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl bg-[var(--color-surface-inset)]">
                  {product.image_url ? (
                    <img
                      src={assetUrl(product.image_url)}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[var(--color-ink-faint)]">
                      <Box className="h-5 w-5" aria-hidden />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{product.name}</p>
                      <p className="mt-0.5 truncate text-xs font-medium uppercase tracking-wider text-[var(--color-ink-faint)]">
                        {product.sku || 'SKU pending'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${stockBadgeClass(product)}`}
                    >
                      {stockLabel(product)}
                    </span>
                  </div>

                  {/* Two columns of label/value on anything above 380px, one
                      below it. Every figure the table shows survives. */}
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
                    {[
                      ['Selling', formatMoneyExact(product.price)],
                      ['Cost', formatMoneyExact(product.cost_price)],
                      ['MRP', formatMoneyExact(product.mrp)],
                      ['Margin', `${marginPercent(product).toFixed(1)}%`],
                      ['On hand', String(product.stock)],
                      ['Reorder', String(product.reorder_level)],
                      ['Status', product.status],
                      ['Location', product.location || '—'],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-[var(--color-ink-faint)]">{label}</dt>
                        <dd className="font-semibold tabular-nums text-[var(--color-ink)]">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <p className="mt-2 text-xs text-[var(--color-ink-faint)]">
                    {product.supplier_name || 'Supplier not set'}
                    {product.supplier_phone ? ` · ${product.supplier_phone}` : ''}
                  </p>

                  <button
                    type="button"
                    onClick={() => onEditProduct(product.id)}
                    className="btn-ghost mt-3 flex w-full items-center justify-center gap-2 sm:w-auto"
                  >
                    <Edit2 className="h-4 w-4" aria-hidden /> Edit
                  </button>
                </div>
              </div>
            </li>
          ))}

          {filteredProducts.length === 0 && (
            <li className="px-6 py-12 text-center text-sm text-[var(--color-ink-faint)]">
              {isLoading
                ? 'Loading products…'
                : searchQuery
                  ? 'No products match that search.'
                  : 'No products yet.'}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
