import React, { useState } from 'react';
import CategoriesList from './CategoriesList';
import ProductEditor from './ProductEditor';
import ProductsList from './ProductsList';
import { Package, Tags } from 'lucide-react';

type SubTab = 'list' | 'categories' | 'edit';

export default function ProductsDashboard() {
  const [activeTab, setActiveTab] = useState<SubTab>('list');
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  const handleEditProduct = (id: number | null) => {
    setEditingProductId(id);
    setActiveTab('edit');
  };

  const handleEditorClose = () => {
    setEditingProductId(null);
    setActiveTab('list');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-label">Products Catalog</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Manage your product offerings</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Create and update products, manage categories, and oversee inventory listings.
          </p>
        </div>
      </div>

      <div className="panel inline-flex gap-2 rounded-2xl p-2">
        <button
          onClick={() => { setActiveTab('list'); setEditingProductId(null); }}
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'list' || activeTab === 'edit'
              ? 'bg-slate-900 text-white shadow-sm' 
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
          }`}
        >
          <Package className="w-4 h-4" /> Products
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'categories'
              ? 'bg-slate-900 text-white shadow-sm' 
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
          }`}
        >
          <Tags className="w-4 h-4" /> Categories
        </button>
      </div>

      <div className="pt-2">
        {activeTab === 'categories' && <CategoriesList />}
        {activeTab === 'list' && <ProductsList onEditProduct={handleEditProduct} />}
        {activeTab === 'edit' && <ProductEditor productId={editingProductId} onClose={handleEditorClose} />}
      </div>
    </div>
  );
}
