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
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Products Catalog</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Manage your product offerings</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Create and update products, manage categories, and oversee inventory listings.
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => { setActiveTab('list'); setEditingProductId(null); }}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'list' || activeTab === 'edit'
              ? 'border-slate-900 text-slate-900' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Package className="w-4 h-4" /> Products
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'categories'
              ? 'border-slate-900 text-slate-900' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
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
