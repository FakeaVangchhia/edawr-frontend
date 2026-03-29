import React, { useEffect, useState } from 'react';
import { Category, Product } from '../types';
import { Image as ImageIcon, ArrowLeft } from 'lucide-react';

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

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then((data) => {
      setCategories(data);
      if (data.length > 0 && !productId) {
        setForm(prev => ({ ...prev, category: data[0].name }));
      }
    }).catch(console.error);

    if (productId) {
      fetch('/api/products').then(r => r.json()).then((products: Product[]) => {
        const product = products.find(p => p.id === productId);
        if (product) {
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
            status: product.status ?? 'Active',
            location: product.location ?? '',
            supplier_name: product.supplier_name ?? '',
            supplier_phone: product.supplier_phone ?? '',
            description: product.description ?? '',
            image_url: product.image_url ?? '',
          });
        }
      });
    }
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

      const response = await fetch('/api/uploads/products/image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Image upload failed');
      }

      setForm(prev => ({ ...prev, image_url: data.image_url }));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Image upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price || !form.stock) return;

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
      const endpoint = productId ? `/api/products/${productId}` : '/api/products';
      const method = productId ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save product');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error saving product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="panel mx-auto max-w-5xl rounded-[2rem]">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="secondary-action -ml-2 p-2 text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-lg font-bold text-slate-950">{productId ? 'Update product master' : 'Create product master'}</h3>
            <p className="mt-1 text-sm text-slate-500">Capture merchandising, pricing, replenishment and supplier information.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8 p-6">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 border-b pb-2 mb-4">Basic details</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 text-sm">
            <label className="block">
              <span className="mb-1.5 block font-medium text-slate-700">Product name *</span>
              <input type="text" required value={form.name} onChange={e => handleFieldChange('name', e.target.value)} className="field-control" placeholder="Product name" />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium text-slate-700">SKU</span>
              <input type="text" value={form.sku} onChange={e => handleFieldChange('sku', e.target.value)} className="field-control" placeholder="SKU-123" />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium text-slate-700">Barcode</span>
              <input type="text" value={form.barcode} onChange={e => handleFieldChange('barcode', e.target.value)} className="field-control" placeholder="EAN/UPC" />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium text-slate-700">Category</span>
              <select value={form.category} onChange={e => handleFieldChange('category', e.target.value)} className="field-control">
                {categories.length === 0 && <option value="General">General</option>}
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium text-slate-700">Brand</span>
              <input type="text" value={form.brand} onChange={e => handleFieldChange('brand', e.target.value)} className="field-control" placeholder="Brand name" />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium text-slate-700">Selling unit</span>
              <input type="text" value={form.unit} onChange={e => handleFieldChange('unit', e.target.value)} className="field-control" placeholder="Piece, kg, box..." />
            </label>
            <label className="block lg:col-span-3">
              <span className="mb-1.5 block font-medium text-slate-700">Description</span>
              <textarea value={form.description} onChange={e => handleFieldChange('description', e.target.value)} rows={3} className="field-control" placeholder="Product details..." />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium text-slate-700">Lifecycle status</span>
              <select value={form.status} onChange={e => handleFieldChange('status', e.target.value)} className="field-control">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Draft">Draft</option>
              </select>
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 border-b pb-2 mb-4">Pricing and stock</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 text-sm">
            <label className="block">
              <span className="mb-1.5 block font-medium text-slate-700">Selling price *</span>
              <input type="number" step="0.01" required value={form.price} onChange={e => handleFieldChange('price', e.target.value)} className="field-control" placeholder="0.00" />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium text-slate-700">Cost price</span>
              <input type="number" step="0.01" value={form.cost_price} onChange={e => handleFieldChange('cost_price', e.target.value)} className="field-control" placeholder="0.00" />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium text-slate-700">MRP</span>
              <input type="number" step="0.01" value={form.mrp} onChange={e => handleFieldChange('mrp', e.target.value)} className="field-control" placeholder="0.00" />
            </label>
            <div className="hidden lg:block"></div>
            <label className="block">
              <span className="mb-1.5 block font-medium text-slate-700">Current stock *</span>
              <input type="number" required value={form.stock} onChange={e => handleFieldChange('stock', e.target.value)} className="field-control" placeholder="0" />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-medium text-slate-700">Reorder level</span>
              <input type="number" value={form.reorder_level} onChange={e => handleFieldChange('reorder_level', e.target.value)} className="field-control" placeholder="10" />
            </label>
            <label className="block lg:col-span-2">
              <span className="mb-1.5 block font-medium text-slate-700">Storage location</span>
              <input type="text" value={form.location} onChange={e => handleFieldChange('location', e.target.value)} className="field-control" placeholder="Rack C2 / Cold Zone" />
            </label>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 border-b pb-2 mb-4">Supplier</p>
            </div>
            <div className="space-y-6 text-sm">
              <label className="block">
                <span className="mb-1.5 block font-medium text-slate-700">Supplier name</span>
                <input type="text" value={form.supplier_name} onChange={e => handleFieldChange('supplier_name', e.target.value)} className="field-control" placeholder="Warehouse Foods Inc." />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-medium text-slate-700">Supplier phone</span>
                <input type="text" value={form.supplier_phone} onChange={e => handleFieldChange('supplier_phone', e.target.value)} className="field-control" placeholder="+1 123 456 7890" />
              </label>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 border-b pb-2 mb-4">Product media</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <div className="overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex-shrink-0">
                {form.image_url ? (
                  <img src={form.image_url} alt={form.name || 'Product preview'} className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-sm font-medium">No image</span>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Upload primary image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      void handleImageUpload(e.target.files?.[0] ?? null);
                      e.currentTarget.value = '';
                    }}
                    className="field-control file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
                  />
                </label>
                <div className="flex flex-wrap gap-2 pt-2">
                  {form.image_url && (
                    <button
                      type="button"
                      onClick={() => handleFieldChange('image_url', '')}
                      className="secondary-action px-3 py-1.5 text-xs font-semibold"
                    >
                      Remove
                    </button>
                  )}
                  {isUploading && <span className="text-xs font-medium text-blue-600 self-center">Uploading...</span>}
                  {imageError && <span className="text-xs font-medium text-rose-600 self-center">{imageError}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="secondary-action px-6 py-2.5 text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="primary-action px-8 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : productId ? 'Update Product' : 'Save Product'}
          </button>
        </div>
      </form>
    </section>
  );
}
