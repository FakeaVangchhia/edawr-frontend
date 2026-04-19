import { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import {
  ArrowRight,
  ListFilter,
  MessageCircle,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Store,
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { apiUrl, assetUrl } from '../lib/api';
import { Product } from '../types';

const FALLBACK_WHATSAPP_URL =
  'https://wa.me/918787698473?text=Hi%20eDawr%2C%20I%20want%20to%20place%20an%20order.';

const whatsappUrl =
  (import.meta.env.VITE_WHATSAPP_URL as string | undefined)?.trim() || FALLBACK_WHATSAPP_URL;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

type StorefrontProps = {
  onOpenAdmin: () => void;
};

export default function Storefront({ onOpenAdmin }: StorefrontProps) {
  const { socket, isConnected } = useSocket();
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [phone, setPhone] = useState('');
  const [whatsAppStatus, setWhatsAppStatus] = useState('');
  const [isStartingWhatsApp, setIsStartingWhatsApp] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const normalizeProduct = (product: Product & { category_name?: string }) => ({
      ...product,
      category: product.category || product.category_name || '',
    });

    const loadProducts = async () => {
      if (isMounted) {
        setIsLoading(true);
        setError('');
      }

      try {
        const response = await fetch(apiUrl('/api/store/products'));
        if (!response.ok) {
          throw new Error('Unable to load products right now.');
        }

        const data: Array<Product & { category_name?: string }> = await response.json();
        if (!isMounted) return;

        setProducts(data.map(normalizeProduct));
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load products right now.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadProducts();

    const refreshCatalog = () => {
      void loadProducts();
    };

    socket?.on('product:updated', refreshCatalog);

    return () => {
      isMounted = false;
      socket?.off('product:updated', refreshCatalog);
    };
  }, [socket]);

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(products.map(product => product.category).filter(Boolean))
    ).sort((left, right) => left.localeCompare(right));

    return ['All', ...uniqueCategories];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return products.filter(product => {
      const matchesCategory =
        selectedCategory === 'All' || product.category === selectedCategory;

      if (!matchesCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        product.name,
        product.category,
        product.brand,
        product.description,
        product.sku,
      ].some(value => value?.toLowerCase().includes(query));
    });
  }, [products, searchQuery, selectedCategory]);

  const availableProductsCount = useMemo(
    () => products.filter(product => product.stock > 0).length,
    [products]
  );

  const selectedItems = useMemo(
    () =>
      products
        .filter(product => (quantities[product.id] ?? 0) > 0)
        .map(product => ({
          ...product,
          quantity: quantities[product.id],
        })),
    [products, quantities]
  );

  const cartSummary = useMemo(() => {
    return selectedItems.reduce(
      (summary, item) => {
        summary.quantity += item.quantity;
        summary.total += item.quantity * item.price;
        return summary;
      },
      { quantity: 0, total: 0 }
    );
  }, [selectedItems]);

  const orderMessage = useMemo(() => {
    if (!selectedItems.length) {
      return '/dawr';
    }

    return `Hi eDawr, I want to place an order for: ${selectedItems
      .map(item => `${item.quantity} ${item.name}`)
      .join(', ')}.`;
  }, [selectedItems]);

  const checkoutUrl = useMemo(() => {
    const separator = whatsappUrl.includes('?') ? '&' : '?';
    if (/([?&])text=/.test(whatsappUrl)) {
      return whatsappUrl;
    }

    return `${whatsappUrl}${separator}text=${encodeURIComponent(orderMessage)}`;
  }, [orderMessage]);

  const updateQuantity = (productId: number, nextQuantity: number) => {
    setQuantities(current => {
      if (nextQuantity <= 0) {
        const { [productId]: _removed, ...rest } = current;
        return rest;
      }

      return { ...current, [productId]: nextQuantity };
    });
  };

  const handleStartTemplate = async () => {
    if (!phone.trim()) {
      setWhatsAppStatus('Enter a WhatsApp number to send the starter message.');
      return;
    }

    setIsStartingWhatsApp(true);
    setWhatsAppStatus('');
    try {
      const response = await fetch(apiUrl('/api/whatsapp/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Unable to start WhatsApp right now.');
      }
      setWhatsAppStatus(`Starter template sent to ${data.phone}.`);
    } catch (startError) {
      setWhatsAppStatus(startError instanceof Error ? startError.message : 'Unable to start WhatsApp right now.');
    } finally {
      setIsStartingWhatsApp(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-950">
      <header className="border-b border-slate-200 bg-white/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/15">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-extrabold tracking-tight">eDawr</div>
              <div className="text-sm text-slate-500">Products</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 sm:block">
              {isConnected ? 'Live catalog connected' : 'Catalog offline'}
            </div>
            <button
              onClick={onOpenAdmin}
              className="secondary-action rounded-full px-4 py-2 text-sm font-semibold transition"
            >
              Open Admin
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className="panel rounded-[2rem] p-6 sm:p-8">
              <div className="space-y-6">
                <div className="max-w-3xl">
                  <div className="section-label">Online Store</div>
                  <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
                    Clean product list.
                  </h1>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                    Search, filter, and order from a tidy catalog.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="text-sm text-slate-500">Products</div>
                    <div className="mt-1 text-2xl font-black text-slate-950">{products.length}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="text-sm text-slate-500">In stock</div>
                    <div className="mt-1 text-2xl font-black text-slate-950">{availableProductsCount}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="text-sm text-slate-500">Categories</div>
                    <div className="mt-1 text-2xl font-black text-slate-950">{categories.length - 1}</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel rounded-[2rem]">
              <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="section-label">Catalog</div>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Items list</h2>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="relative min-w-0 sm:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={event => setSearchQuery(event.target.value)}
                      placeholder="Search items..."
                      className="field-control py-2.5 pl-10 pr-3 text-sm"
                    />
                  </label>

                  <label className="relative min-w-0 sm:w-52">
                    <ListFilter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      value={selectedCategory}
                      onChange={event => setSelectedCategory(event.target.value)}
                      className="field-control appearance-none py-2.5 pl-10 pr-8 text-sm"
                    >
                      {categories.map(category => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {isLoading ? (
                <div className="px-6 py-12 text-center text-slate-500">Loading products...</div>
              ) : error ? (
                <div className="px-6 py-12 text-center text-rose-700">{error}</div>
              ) : filteredProducts.length === 0 ? (
                <div className="px-6 py-12 text-center text-slate-500">No products available yet.</div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {filteredProducts.map(product => {
                    const quantity = quantities[product.id] ?? 0;
                    const isAvailable = product.stock > 0;

                    return (
                      <article
                        key={product.id}
                        className="grid gap-4 px-6 py-5 md:grid-cols-[96px_minmax(0,1fr)_120px_136px] md:items-center"
                      >
                        <div className="h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                          {product.image_url ? (
                            <img src={assetUrl(product.image_url)} alt={product.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-slate-400">
                              <Package className="h-8 w-8" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-col gap-2">
                            <div>
                              <h3 className="text-lg font-bold text-slate-950">{product.name}</h3>
                              <div className="mt-1 flex flex-wrap gap-2 text-sm text-slate-500">
                                <span>{product.category}</span>
                                {product.brand && <span>{product.brand}</span>}
                                <span>{product.unit}</span>
                              </div>
                            </div>
                          </div>

                          {product.description && (
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{product.description}</p>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                            {product.sku && <span>SKU: {product.sku}</span>}
                            {product.location && <span>Location: {product.location}</span>}
                            {product.supplier_name && <span>Supplier: {product.supplier_name}</span>}
                          </div>
                        </div>

                        <div className="flex flex-col items-start gap-3 md:items-end">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {isAvailable ? `${product.stock} in stock` : 'Out of stock'}
                          </span>
                          <div className="text-left md:text-right">
                            <div className="text-2xl font-black text-slate-950">{formatCurrency(product.price)}</div>
                            <div className="text-sm text-slate-500">per {product.unit}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-start md:justify-end">
                          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 shadow-inner">
                            <button
                              type="button"
                              onClick={() => updateQuantity(product.id, quantity - 1)}
                              disabled={quantity === 0}
                              className="rounded-full p-2 text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="min-w-8 text-center text-sm font-bold text-slate-950">{quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(product.id, quantity + 1)}
                              disabled={!isAvailable || quantity >= product.stock}
                              className="rounded-full p-2 text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="panel rounded-[2rem] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-950">Selected items</div>
                  <div className="text-sm text-slate-500">{cartSummary.quantity} item(s) selected</div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-center rounded-[1.75rem] border border-slate-200 bg-white p-5">
                <div className="text-center">
                  <QRCode value={checkoutUrl} size={148} />
                  <div className="mt-3 text-sm font-medium text-slate-500">Scan to order</div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {selectedItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Add items to prepare an order.
                  </div>
                ) : (
                  selectedItems.map(item => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          <div className="text-sm text-slate-500">
                            {item.quantity} x {formatCurrency(item.price)}
                          </div>
                        </div>
                        <div className="font-semibold text-slate-900">
                          {formatCurrency(item.quantity * item.price)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-5 rounded-2xl bg-slate-900 px-4 py-4 text-white">
                <div className="text-sm text-slate-300">Total</div>
                <div className="mt-1 text-3xl font-black">{formatCurrency(cartSummary.total)}</div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                {orderMessage}
              </div>

              <a
                href={checkoutUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-600"
              >
                Order on WhatsApp
                <ArrowRight className="h-4 w-4" />
              </a>
            </section>

            <section className="panel rounded-[2rem] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-950">Send WhatsApp starter</div>
                  <div className="text-sm text-slate-500">Start chat from a number.</div>
                </div>
              </div>

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-medium text-slate-700">WhatsApp number</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                  placeholder="Enter your mobile number"
                  className="field-control text-sm"
                />
              </label>

              <button
                type="button"
                onClick={handleStartTemplate}
                disabled={isStartingWhatsApp}
                className="primary-action mt-4 inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MessageCircle className="h-4 w-4" />
                {isStartingWhatsApp ? 'Sending...' : 'Send Starter Message'}
              </button>

              {whatsAppStatus && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {whatsAppStatus}
                </div>
              )}
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
