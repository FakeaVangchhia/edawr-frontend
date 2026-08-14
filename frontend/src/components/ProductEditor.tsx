'use client';

/* eslint-disable @next/next/no-img-element -- Product images come from the
   Django backend at a host only known at runtime (NEXT_PUBLIC_API_URL), so
   next/image's remotePatterns cannot be configured at build time without
   baking the hostname in — the one thing assetUrl() exists to avoid. See
   ProductCard.tsx for the same reasoning on the storefront. */

import React, { useEffect, useState } from 'react';
import { Category, Product } from '../types';
import { Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { authRequest, assetUrl } from '../lib/api';

interface ProductEditorProps {
  productId: number | null;
  onClose: () => void;
}

type ProductFormState = {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  unit: string;
  price: string;
  cost_price: string;
  mrp: string;
  stock: string;
  reorder_level: string;
  status: string;
  location: string;
  supplier_name: string;
  supplier_phone: string;
  description: string;
  image_url: string;
};

const emptyProductForm = (): ProductFormState => ({
  name: '',
  sku: '',
  barcode: '',
  category: '',
  brand: '',
  unit: 'unit',
  price: '',
  cost_price: '',
  mrp: '',
  stock: '',
  reorder_level: '10',
  status: 'Active',
  location: '',
  supplier_name: '',
  supplier_phone: '',
  description: '',
  image_url: '',
});

export default function ProductEditor({ productId, onClose }: ProductEditorProps) {
  const [form, setForm] = useState<ProductFormState>(emptyProductForm());
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    // `cancelled` rather than an AbortController: both requests only ever set
    // state, so dropping the result is enough, and it keeps the two awaits in
    // one readable block.
    let cancelled = false;

    (async () => {
      try {
        const rows = await authRequest<Category[]>('/api/categories');
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setCategories(list);
        if (list.length > 0 && !productId) {
          setForm(prev => ({ ...prev, category: list[0].name }));
        }
      } catch {
        // A missing category list is recoverable — the field falls back to
        // free text — so this does not deserve the error banner that a failed
        // save gets.
        if (!cancelled) setCategories([]);
      }

      if (!productId) return;

      try {
        const products = await authRequest<Product[]>('/api/products');
        if (cancelled || !Array.isArray(products)) return;
        const product = products.find(p => p.id === productId);
        if (!product) {
          setSaveError('That product no longer exists.');
          return;
        }
        setForm({
          name: product.name ?? '',
          sku: product.sku ?? '',
          barcode: product.barcode ?? '',
          category: product.category ?? '',
          brand: product.brand ?? '',
          unit: product.unit ?? 'unit',
          price: String(product.price ?? ''),
          cost_price: String(product.cost_price ?? ''),
          mrp: String(product.mrp ?? ''),
          stock: String(product.stock ?? ''),
          reorder_level: String(product.reorder_level ?? 10),
          status: product.status ?? 'active',
          location: product.location ?? '',
          supplier_name: product.supplier_name ?? '',
          supplier_phone: product.supplier_phone ?? '',
          description: product.description ?? '',
          image_url: product.image_url ?? '',
        });
      } catch (caught) {
        // This one *is* fatal: without the current values, a PUT would replace
        // the row with an empty form. Say so instead of failing silently, which
        // is what the missing `.catch` here used to do.
        if (!cancelled) {
          setSaveError(
            caught instanceof Error ? caught.message : 'Could not load this product.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  const handleFieldChange = (field: keyof ProductFormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (file: File | null) => {
    if (!file) return;

    setImageError('');
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // `request()` skips Content-Type for FormData so the browser can set the
      // multipart boundary itself.
      const data = await authRequest<{ image_url: string }>(
        '/api/uploads/products/image',
        { method: 'POST', body: formData },
      );

      setForm(prev => ({ ...prev, image_url: data.image_url }));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Image upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    if (!form.name.trim() || !form.price || !form.stock) {
      // Silently returning here left the manager tapping Save with nothing
      // happening — the native `required` attributes do not cover `stock`
      // being an empty string.
      setSaveError('Name, price and stock are all required.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim(),
      category: form.category.trim() || 'General',
      brand: form.brand.trim(),
      unit: form.unit.trim() || 'unit',
      price: Number(form.price),
      cost_price: Number(form.cost_price || 0),
      mrp: Number(form.mrp || 0),
      stock: Number(form.stock),
      reorder_level: Number(form.reorder_level || 0),
      status: form.status,
      location: form.location.trim(),
      supplier_name: form.supplier_name.trim(),
      supplier_phone: form.supplier_phone.trim(),
      description: form.description.trim(),
      image_url: form.image_url.trim(),
    };

    setIsSubmitting(true);
    try {
      await authRequest(productId ? `/api/products/${productId}` : '/api/products', {
        method: productId ? 'PUT' : 'POST',
        body: payload,
      });
      onClose();
    } catch (caught) {
      // The backend names the offending field — "mrp: MRP cannot be lower than
      // the selling price." — and `api/exceptions.py` exists to guarantee that
      // sentence. An alert() saying "Error saving product" threw away the only
      // part that tells the manager what to change.
      setSaveError(
        caught instanceof Error ? caught.message : 'Could not save this product.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="card mx-auto max-w-5xl">
      <div className="px-4 py-5 sm:px-6">
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={onClose}
            className="btn-icon -ml-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-lg font-bold">{productId ? 'Update product master' : 'Create product master'}</h3>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Capture merchandising, pricing, replenishment and supplier information.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8 px-4 pb-6 sm:px-6">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-faint)] mb-4">Basic details</p>
          </div>
          <div className="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block font-medium">Product name *</span>
              <input type="text" required value={form.name} onChange={e => handleFieldChange('name', e.target.value)} className="field" placeholder="Product name" />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium">SKU</span>
              <input type="text" value={form.sku} onChange={e => handleFieldChange('sku', e.target.value)} className="field" placeholder="SKU-123" />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium">Barcode</span>
              <input type="text" value={form.barcode} onChange={e => handleFieldChange('barcode', e.target.value)} className="field" placeholder="EAN/UPC" />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium">Category</span>
              <select value={form.category} onChange={e => handleFieldChange('category', e.target.value)} className="field">
                {categories.length === 0 && <option value="General">General</option>}
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium">Brand</span>
              <input type="text" value={form.brand} onChange={e => handleFieldChange('brand', e.target.value)} className="field" placeholder="Brand name" />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium">Selling unit</span>
              <input type="text" value={form.unit} onChange={e => handleFieldChange('unit', e.target.value)} className="field" placeholder="Piece, kg, box..." />
            </label>
            <label className="block lg:col-span-3">
              <span className="mb-1.5 block font-medium">Description</span>
              <textarea value={form.description} onChange={e => handleFieldChange('description', e.target.value)} rows={3} className="field" placeholder="Product details..." />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium">Lifecycle status</span>
              <select value={form.status} onChange={e => handleFieldChange('status', e.target.value)} className="field">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Draft">Draft</option>
              </select>
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-faint)] mb-4">Pricing and stock</p>
          </div>
          <div className="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block font-medium">Selling price *</span>
              <input type="number" step="0.01" required value={form.price} onChange={e => handleFieldChange('price', e.target.value)} className="field" placeholder="0.00" />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium">Cost price</span>
              <input type="number" step="0.01" value={form.cost_price} onChange={e => handleFieldChange('cost_price', e.target.value)} className="field" placeholder="0.00" />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium">MRP</span>
              <input type="number" step="0.01" value={form.mrp} onChange={e => handleFieldChange('mrp', e.target.value)} className="field" placeholder="0.00" />
            </label>
            <div className="hidden lg:block"></div>
            <label className="block">
              <span className="mb-1.5 block font-medium">Current stock *</span>
              <input type="number" required value={form.stock} onChange={e => handleFieldChange('stock', e.target.value)} className="field" placeholder="0" />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium">Reorder level</span>
              <input type="number" value={form.reorder_level} onChange={e => handleFieldChange('reorder_level', e.target.value)} className="field" placeholder="10" />
            </label>
            <label className="block lg:col-span-2">
              <span className="mb-1.5 block font-medium">Storage location</span>
              <input type="text" value={form.location} onChange={e => handleFieldChange('location', e.target.value)} className="field" placeholder="Rack C2 / Cold Zone" />
            </label>
          </div>
        </div>
        
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-faint)] mb-4">Supplier</p>
            </div>
            <div className="space-y-6 text-sm">
              <label className="block">
                <span className="mb-1.5 block font-medium">Supplier name</span>
                <input type="text" value={form.supplier_name} onChange={e => handleFieldChange('supplier_name', e.target.value)} className="field" placeholder="Warehouse Foods Inc." />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-medium">Supplier phone</span>
                <input type="text" value={form.supplier_phone} onChange={e => handleFieldChange('supplier_phone', e.target.value)} className="field" placeholder="+1 123 456 7890" />
              </label>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-faint)] mb-4">Product media</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-2xl bg-[var(--color-surface-inset)] flex-shrink-0">
                {form.image_url ? (
                  <img src={assetUrl(form.image_url)} alt={form.name || 'Product preview'} className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-[var(--color-ink-faint)]">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-sm font-medium">No image</span>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Upload primary image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      void handleImageUpload(e.target.files?.[0] ?? null);
                      e.currentTarget.value = '';
                    }}
                    className="field file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-brand-500)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--color-navy-900)]"
                  />
                </label>
                <div className="flex flex-wrap gap-2 pt-2">
                  {form.image_url && (
                    <button
                      type="button"
                      onClick={() => handleFieldChange('image_url', '')}
                      className="btn-ghost px-3 py-1.5 text-xs font-semibold"
                    >
                      Remove
                    </button>
                  )}
                  {isUploading && (
                    <span className="self-center text-xs font-semibold text-[var(--color-ink-soft)]">
                      Uploading…
                    </span>
                  )}
                  {imageError && (
                    <span
                      role="alert"
                      className="self-center text-xs font-semibold text-[var(--color-danger-600)]"
                    >
                      {imageError}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Beside the buttons, not at the top of a long form: the manager is
            looking here when the save fails, and a banner three screens up
            reads as nothing having happened at all. */}
        {saveError && (
          <div
            role="alert"
            className="rounded-2xl bg-[var(--color-danger-50)] px-4 py-3 text-sm font-semibold text-[var(--color-danger-600)]"
          >
            {saveError}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-6 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" onClick={onClose} className="btn-ghost px-6">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="btn-primary px-8">
            {isSubmitting ? 'Saving…' : productId ? 'Update product' : 'Save product'}
          </button>
        </div>
      </form>
    </section>
  );
}
