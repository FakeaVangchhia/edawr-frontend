import React, { useEffect, useState } from 'react';
import { Category } from '../types';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { authFetch } from '../lib/api';

export default function CategoriesList() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editCategory, setEditCategory] = useState<Partial<Category> | null>(null);
  const [error, setError] = useState('');

  const fetchCategories = () => {
    authFetch('/api/categories')
      .then(r => r.json())
      .then(setCategories)
      .catch(console.error);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCategory) return;
    
    setError('');
    try {
      const url = editCategory.id ? `/api/categories/${editCategory.id}` : '/api/categories';
      const method = editCategory.id ? 'PUT' : 'POST';
      
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editCategory.name,
          description: editCategory.description || '',
          parent_id: editCategory.parent_id || null,
          status: editCategory.status || 'Active'
        })
      });
      
      if (!res.ok) {
        throw new Error((await res.json()).detail || 'Failed to save category');
      }
      
      fetchCategories();
      setIsEditing(false);
      setEditCategory(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    
    try {
      const res = await authFetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error((await res.json()).detail || 'Failed to delete category');
      }
      fetchCategories();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (isEditing && editCategory) {
    return (
      <div className="panel rounded-[1.75rem] p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">{editCategory.id ? 'Edit Category' : 'New Category'}</h3>
        {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
        
        <form onSubmit={handleSave} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category Name</label>
            <input 
              type="text" 
              required
              value={editCategory.name || ''} 
              onChange={e => setEditCategory({...editCategory, name: e.target.value})}
              className="field-control"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea 
              rows={3}
              value={editCategory.description || ''} 
              onChange={e => setEditCategory({...editCategory, description: e.target.value})}
              className="field-control"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Parent Category</label>
              <select
                value={editCategory.parent_id || ''}
                onChange={e => setEditCategory({...editCategory, parent_id: e.target.value ? Number(e.target.value) : null})}
                className="field-control"
              >
                <option value="">None (Top Level)</option>
                {categories.filter(c => c.id !== editCategory.id).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={editCategory.status || 'Active'}
                onChange={e => setEditCategory({...editCategory, status: e.target.value})}
                className="field-control"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="primary-action px-4 py-2 text-sm font-medium"
            >
              Save Category
            </button>
            <button
              type="button"
              onClick={() => { setIsEditing(false); setEditCategory(null); setError(''); }}
              className="secondary-action px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden rounded-[1.75rem]">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 bg-slate-50/80">
        <div>
          <p className="section-label">Taxonomy</p>
          <h3 className="mt-1 font-semibold text-slate-900">Product Categories</h3>
        </div>
        <button 
          onClick={() => {
            setEditCategory({ name: '', description: '', status: 'Active', parent_id: null });
            setIsEditing(true);
          }}
          className="primary-action flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Category
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-white text-slate-500 uppercase text-xs font-semibold border-b border-slate-200">
            <tr>
              <th className="px-6 py-3">Category Name</th>
              <th className="px-6 py-3">Description</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 font-medium text-slate-900">{c.name}</td>
                <td className="px-6 py-4 text-slate-500">{c.description || '-'}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                    ${c.status === 'Active' ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-700'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => { setEditCategory(c); setIsEditing(true); }}
                      className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(c.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  No categories defined yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
