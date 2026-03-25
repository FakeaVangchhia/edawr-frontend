import { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import {
  ArrowRight,
  MessageCircle,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Store,
} from 'lucide-react';
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
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsAppStatus, setWhatsAppStatus] = useState('');
  const [isStartingWhatsApp, setIsStartingWhatsApp] = useState(false);

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch('/api/products');
        if (!response.ok) {
          throw new Error('Unable to load products right now.');
        }
        const data: Product[] = await response.json();
        setProducts(data.filter(product => product.status === 'Active'));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load products right now.');
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, []);

  const updateQuantity = (productId: number, nextQuantity: number) => {
    setQuantities(current => {
      if (nextQuantity <= 0) {
        const { [productId]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [productId]: nextQuantity };
    });
  };

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

  const orderMessage = useMemo(() => {
    if (!selectedItems.length) {
      return 'Hi eDawr, I want to place an order.';
    }

    return selectedItems.map(item => `${item.quantity} ${item.name}`).join(', ');
  }, [selectedItems]);

  const checkoutUrl = useMemo(() => {
    const separator = whatsappUrl.includes('?') ? '&' : '?';
    if (/([?&])text=/.test(whatsappUrl)) {
      return whatsappUrl;
    }
    return `${whatsappUrl}${separator}text=${encodeURIComponent(orderMessage)}`;
  }, [orderMessage]);

  const totalItems = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = selectedItems.reduce((sum, item) => sum + item.quantity * item.price, 0);

  const handleStartTemplate = async () => {
    if (!phone.trim()) {
      setWhatsAppStatus('Enter a WhatsApp number to send the starter message.');
      return;
    }

    setIsStartingWhatsApp(true);
    setWhatsAppStatus('');
    try {
      const response = await fetch('/api/whatsapp/start', {
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#ecfdf5_52%,#f8fafc_100%)] text-slate-950">
      <header className="border-b border-emerald-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight">eDawr</div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">WhatsApp-first ordering</div>
            </div>
          </div>
          <button
            onClick={onOpenAdmin}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
          >
            Open Admin
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)] backdrop-blur">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              <Sparkles className="h-4 w-4" />
              Shop and order directly on WhatsApp
            </div>
            <h1 className="mt-5 max-w-2xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Let customers discover products and start ordering in one tap.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Browse the live catalog, pick quantities, and either send the Meta starter template or launch WhatsApp with a ready-to-send order message.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50/80 p-4">
                <div className="text-sm font-semibold text-emerald-700">Catalog sync</div>
                <div className="mt-2 text-2xl font-black text-slate-950">{products.length}</div>
                <div className="text-sm text-slate-600">active products shown to customers</div>
              </div>
              <div className="rounded-3xl border border-amber-100 bg-amber-50/80 p-4">
                <div className="text-sm font-semibold text-amber-700">Cart items</div>
                <div className="mt-2 text-2xl font-black text-slate-950">{totalItems}</div>
                <div className="text-sm text-slate-600">products prepared for WhatsApp</div>
              </div>
              <div className="rounded-3xl border border-sky-100 bg-sky-50/80 p-4">
                <div className="text-sm font-semibold text-sky-700">Order value</div>
                <div className="mt-2 text-2xl font-black text-slate-950">{formatCurrency(totalAmount)}</div>
                <div className="text-sm text-slate-600">estimated basket total</div>
              </div>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.55)]">
            <div className="flex items-center gap-2 text-emerald-300">
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-[0.24em]">Order on WhatsApp</span>
            </div>
            <p className="mt-4 text-2xl font-black tracking-tight">Ready-to-send message</p>
            
            <div className="mt-6 flex flex-col items-center rounded-3xl bg-white p-6">
              <QRCode value={checkoutUrl} size={160} />
              <p className="mt-4 text-center text-sm font-semibold text-slate-500">
                Scan with your phone to order
              </p>
            </div>

            <div className="mt-6 rounded-3xl bg-white/8 p-4 text-sm leading-7 text-slate-100">
              {orderMessage}
            </div>

            <label className="mt-6 block">
              <span className="mb-2 block text-sm font-semibold text-slate-200">Or send starter to number</span>
              <input
                type="tel"
                value={phone}
                onChange={event => setPhone(event.target.value)}
                placeholder="Enter your mobile numer"
                className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-400"
              />
            </label>
            <button
              type="button"
              onClick={handleStartTemplate}
              disabled={isStartingWhatsApp}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-white/8 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isStartingWhatsApp ? 'Sending starter message...' : 'Send WhatsApp Starter Template'}
            </button>
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-400"
            >
              Start on WhatsApp
              <ArrowRight className="h-4 w-4" />
            </a>
            {whatsAppStatus && (
              <div className="mt-3 rounded-2xl bg-white/8 px-4 py-3 text-sm text-slate-200">
                {whatsAppStatus}
              </div>
            )}
            <p className="mt-3 text-xs leading-6 text-slate-300">
              Tip: the generated format uses values like <span className="font-mono">2 Milk, 1 Bread</span>, which your backend can already parse.
            </p>

            <div className="mt-8 grid gap-3">
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <ShoppingBasket className="mt-0.5 h-4 w-4 text-emerald-300" />
                <div>
                  <div className="text-sm font-semibold">Simple customer flow</div>
                  <div className="mt-1 text-sm text-slate-300">Choose products here, confirm the message inside WhatsApp, and place the order.</div>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                <div>
                  <div className="text-sm font-semibold">Powered by live stock</div>
                  <div className="mt-1 text-sm text-slate-300">Only active products are displayed, so the storefront stays aligned with your catalog.</div>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Product catalog</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Show the products and let users build an order</h2>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
              Loading products...
            </div>
          ) : error ? (
            <div className="mt-6 rounded-[2rem] border border-rose-200 bg-rose-50 p-10 text-center text-rose-700 shadow-sm">
              {error}
            </div>
          ) : products.length === 0 ? (
            <div className="mt-6 rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 shadow-sm">
              No active products are available yet.
            </div>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {products.map(product => {
                const quantity = quantities[product.id] ?? 0;
                const isAvailable = product.stock > 0;

                return (
                  <article
                    key={product.id}
                    className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-[0_18px_50px_-30px_rgba(15,23,42,0.55)]"
                  >
                    <div className="aspect-[4/3] bg-slate-100">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-400">
                          <Package className="h-12 w-12" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xl font-black tracking-tight text-slate-950">{product.name}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            {product.category}{product.brand ? ` | ${product.brand}` : ''}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {isAvailable ? `${product.stock} in stock` : 'Out of stock'}
                        </span>
                      </div>

                      {product.description && (
                        <p className="text-sm leading-6 text-slate-600">{product.description}</p>
                      )}

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-black text-slate-950">{formatCurrency(product.price)}</div>
                          <div className="text-sm text-slate-500">per {product.unit}</div>
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
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
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
