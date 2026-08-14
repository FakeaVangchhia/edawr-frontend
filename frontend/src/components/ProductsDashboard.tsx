'use client';

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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
            Products catalogue
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-balance">
            Manage your product offerings
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--color-ink-soft)]">
            Create and update products, manage categories, and oversee inventory listings.
          </p>
        </div>
      </div>

      <div className="card inline-flex gap-2 p-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab('list');
            setEditingProductId(null);
          }}
          aria-current={activeTab !== 'categories' ? 'page' : undefined}
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab !== 'categories'
              ? 'bg-[var(--color-brand-500)] text-[var(--color-navy-900)]'
              : 'text-[var(--color-ink-faint)] hover:bg-[var(--color-surface-sunken)]'
          }`}
        >
          <Package className="h-4 w-4" aria-hidden /> Products
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          aria-current={activeTab === 'categories' ? 'page' : undefined}
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'categories'
              ? 'bg-[var(--color-brand-500)] text-[var(--color-navy-900)]'
              : 'text-[var(--color-ink-faint)] hover:bg-[var(--color-surface-sunken)]'
          }`}
        >
          <Tags className="h-4 w-4" aria-hidden /> Categories
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
