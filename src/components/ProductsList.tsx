import { useEffect, useMemo, useState } from 'react';
import { Product } from '../types';
import { Box, Edit2, Image as ImageIcon, MapPin, Search, ShieldCheck, Users } from 'lucide-react';
import { assetUrl, authFetch } from '../lib/api';

interface ProductsListProps {
  onEditProduct: (id: number | null) => void;
}

const stockBadgeClass = (product: Product) => {
  if (product.stock <= 0) return 'bg-rose-100 text-rose-700';
  if (product.stock <= product.reorder_level) return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
};

const stockLabel = (product: Product) => {
  if (product.stock <= 0) return 'Out of stock';
  if (product.stock <= product.reorder_level) return 'Reorder soon';
  return 'Healthy';
};

const marginPercent = (product: Product) => {
  if (!product.price) return 0;
  return ((product.price - product.cost_price) / product.price) * 100;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

export default function ProductsList({ onEditProduct }: ProductsListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProducts = () => {
    authFetch('/api/products')
      .then(r => r.json())
      .then(setProducts)
      .catch(console.error);
  };

  useEffect(() => {
    fetchProducts();
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

  return (
    <div className="space-y-5">
      <div className="panel rounded-[1.75rem]">
        <div className="flex w-full flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-950">Product registry</h3>
            <p className="mt-1 text-sm text-slate-500">Search, review stock health, inspect suppliers and reopen a SKU for editing.</p>
          </div>
          <div className="flex w-full max-w-xl gap-4">
            <label className="relative block flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, SKU, category, brand..."
                className="field-control py-2.5 pl-10 pr-3 text-sm"
              />
            </label>
            <button
              onClick={() => onEditProduct(null)}
              className="primary-action whitespace-nowrap px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              Add Product
            </button>
          </div>
        </div>

        <div className="grid gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <MapPin className="h-4 w-4 text-slate-400" />
              Storage control
            </div>
            <p className="mt-2 text-sm text-slate-500">Every SKU carries a location tag so pickers know exactly where to source it.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ImageIcon className="h-4 w-4 text-slate-400" />
              Product imagery
            </div>
            <p className="mt-2 text-sm text-slate-500">Each SKU can now carry a visual reference for faster picking and cleaner catalog review.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Users className="h-4 w-4 text-slate-400" />
              Vendor traceability
            </div>
            <p className="mt-2 text-sm text-slate-500">Supplier contact fields are directly editable here for replenishment and escalation.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              Reorder discipline
            </div>
            <p className="mt-2 text-sm text-slate-500">Low stock and out-of-stock products are flagged against the configured reorder level.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Product</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Pricing</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Inventory</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Operations</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredProducts.map(product => (
                <tr key={product.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-6 py-5">
                    <div className="flex gap-3">
                      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                        {product.image_url ? (
                          <img src={assetUrl(product.image_url)} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-600">
                            <Box className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{product.name}</div>
                        <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400">
                          {product.sku || 'SKU pending'} {product.barcode ? `• ${product.barcode}` : ''}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{product.category}</span>
                          {product.brand && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{product.brand}</span>}
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{product.unit}</span>
                        </div>
                        {product.description && (
                          <p className="mt-3 line-clamp-2 max-w-xs text-sm text-slate-500">{product.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-600">
                    <div className="space-y-1.5">
                      <div className="flex justify-between gap-6"><span>Selling</span><span className="font-semibold text-slate-900">{formatCurrency(product.price)}</span></div>
                      <div className="flex justify-between gap-6"><span>Cost</span><span>{formatCurrency(product.cost_price)}</span></div>
                      <div className="flex justify-between gap-6"><span>MRP</span><span>{formatCurrency(product.mrp)}</span></div>
                      <div className="flex justify-between gap-6"><span>Margin</span><span className="font-semibold text-emerald-700">{marginPercent(product).toFixed(1)}%</span></div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-600">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-6">
                        <span>On hand</span>
                        <span className="font-semibold text-slate-900">{product.stock}</span>
                      </div>
                      <div className="flex items-center justify-between gap-6">
                        <span>Reorder</span>
                        <span className="font-semibold text-slate-900">{product.reorder_level}</span>
                      </div>
                      <div className="pt-1">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stockBadgeClass(product)}`}>
                          {stockLabel(product)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-600">
                    <div className="space-y-2">
                      <div className="font-semibold text-slate-900">{product.status}</div>
                      <div className="text-slate-500">{product.location || 'Location not set'}</div>
                      <div>{product.supplier_name || 'Supplier not set'}</div>
                      {product.supplier_phone && <div className="text-slate-500">{product.supplier_phone}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <button
                      onClick={() => onEditProduct(product.id)}
                      className="secondary-action flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors"
                    >
                      <Edit2 className="w-4 h-4" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
