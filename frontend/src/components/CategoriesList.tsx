'use client';

import React, { useEffect, useState } from 'react';
import { Category } from '../types';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { authRequest } from '../lib/api';

/**
 * The category editor sends the **whole** record, not just the edited fields.
 *
 * `CategoryDetailView` uses a non-partial `PUT` — by design, so a PUT genuinely
 * replaces — and `CategorySerializer` declares `image_url` with a default of
 * `null` and `sort_order` with a default of `0`. So a payload that omits them
 * does not leave them alone: it resets them. Fixing a typo in a category name
 * used to blank the storefront rail image and send the tile back to position 0,
 * with nothing in the UI mentioning either field.
 *
 * Extracted and exported so the round-trip can be tested without a DOM — the
 * defect lives entirely in this function.
 */
export function categoryPutBody(category: Partial<Category>) {
  return {
    name: category.name,
    description: category.description || '',
    parent_id: category.parent_id || null,
    // Lowercase to match the model default and `manage.py seed`. The backend
    // filters with `status__iexact`, so casing never broke the storefront — it
    // broke this screen, which compared exactly and showed every seeded
    // category as inactive.
    status: (category.status || 'active').toLowerCase(),
    // The two fields this form cannot edit, preserved rather than defaulted.
    image_url: category.image_url ?? null,
    sort_order: category.sort_order ?? 0,
  };
}

const isActive = (status: string | null | undefined) =>
  (status || '').toLowerCase() === 'active';

export default function CategoriesList() {
  /**
   * One piece of state for the fetch, `null` until it first lands, with the
   * loading flag *derived* from that rather than tracked. A flag set at the top
   * of the effect body would be a synchronous setState inside an effect — a
   * cascading render, and an error under `react-hooks/set-state-in-effect`.
   */
  const [result, setResult] = useState<{ rows: Category[]; error: string } | null>(
    null,
  );
  /** Bumped from a handler to refetch after a save or delete. */
  const [reloadToken, setReloadToken] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editCategory, setEditCategory] = useState<Partial<Category> | null>(null);
  const [error, setError] = useState('');
  /** Which row is asking "are you sure?", if any. */
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  const categories = result?.rows ?? [];
  const isLoading = result === null;
  const loadError = result?.error ?? '';

  useEffect(() => {
    let cancelled = false;

    authRequest<Category[]>('/api/categories')
      .then((rows) => {
        if (cancelled) return;
        // Guard the shape, not just the status. A failed request used to put
        // `{"detail": ...}` here, and the `.map()` below then threw during
        // render and blanked the whole console, logout button included.
        setResult({ rows: Array.isArray(rows) ? rows : [], error: '' });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setResult({
          rows: [],
          error:
            caught instanceof Error ? caught.message : 'Could not load categories.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = () => setReloadToken((token) => token + 1);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editCategory) return;

    setError('');
    try {
      await authRequest(
        editCategory.id ? `/api/categories/${editCategory.id}` : '/api/categories',
        {
          method: editCategory.id ? 'PUT' : 'POST',
          body: categoryPutBody(editCategory),
        },
      );
      reload();
      setIsEditing(false);
      setEditCategory(null);
    } catch (caught) {
      // ApiError carries the backend's own sentence, which names the offending
      // field. Replacing it with "Failed to save" throws away the only part
      // that tells the manager what to change.
      setError(caught instanceof Error ? caught.message : 'Failed to save category.');
    }
  };

  const handleDelete = async (id: number) => {
    setPendingDelete(null);
    try {
      await authRequest(`/api/categories/${id}`, { method: 'DELETE' });
      reload();
    } catch (caught) {
      // Reuse the same banner the list uses — a delete failure belongs beside
      // the row it failed on, not in an alert() the manager dismisses.
      setResult((current) => ({
        rows: current?.rows ?? [],
        error:
          caught instanceof Error ? caught.message : 'Failed to delete category.',
      }));
    }
  };

  if (isEditing && editCategory) {
    return (
      <div className="card p-6">
        <h3 className="mb-4 text-lg font-bold">
          {editCategory.id ? 'Edit category' : 'New category'}
        </h3>
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-2xl bg-[var(--color-danger-50)] p-3 text-sm font-semibold text-[var(--color-danger-600)]"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="max-w-lg space-y-4">
          <div>
            <label htmlFor="category-name" className="mb-1 block text-sm font-semibold">
              Category name
            </label>
            <input
              id="category-name"
              type="text"
              required
              value={editCategory.name || ''}
              onChange={(e) => setEditCategory({ ...editCategory, name: e.target.value })}
              className="field"
            />
          </div>
          <div>
            <label
              htmlFor="category-description"
              className="mb-1 block text-sm font-semibold"
            >
              Description
            </label>
            <textarea
              id="category-description"
              rows={3}
              value={editCategory.description || ''}
              onChange={(e) =>
                setEditCategory({ ...editCategory, description: e.target.value })
              }
              className="field"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="category-parent" className="mb-1 block text-sm font-semibold">
                Parent category
              </label>
              <select
                id="category-parent"
                value={editCategory.parent_id || ''}
                onChange={(e) =>
                  setEditCategory({
                    ...editCategory,
                    parent_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="field"
              >
                <option value="">None (top level)</option>
                {categories
                  .filter((c) => c.id !== editCategory.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label htmlFor="category-status" className="mb-1 block text-sm font-semibold">
                Status
              </label>
              <select
                id="category-status"
                value={isActive(editCategory.status) ? 'active' : 'inactive'}
                onChange={(e) =>
                  setEditCategory({ ...editCategory, status: e.target.value })
                }
                className="field"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="category-sort" className="mb-1 block text-sm font-semibold">
              Sort order
            </label>
            <input
              id="category-sort"
              type="number"
              value={editCategory.sort_order ?? 0}
              onChange={(e) =>
                setEditCategory({ ...editCategory, sort_order: Number(e.target.value) })
              }
              className="field"
            />
            {/* Surfaced because it is round-tripped. A value the form sends but
                cannot show is exactly how it came to be silently reset. */}
            <p className="mt-1 text-sm text-[var(--color-ink-faint)]">
              Lower numbers appear first on the storefront rail.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" className="btn-primary flex-1">
              Save category
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setEditCategory(null);
                setError('');
              }}
              className="btn-ghost flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
            Taxonomy
          </p>
          <h3 className="mt-1 text-lg font-bold">Product categories</h3>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditCategory({
              name: '',
              description: '',
              status: 'active',
              parent_id: null,
              sort_order: 0,
            });
            setIsEditing(true);
          }}
          className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto"
        >
          <Plus className="h-4 w-4" aria-hidden /> New category
        </button>
      </div>

      {loadError && (
        <div
          role="alert"
          className="px-4 py-3 text-sm font-semibold text-[var(--color-danger-600)] sm:px-6"
        >
          {loadError}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="bg-[var(--color-surface-sunken)] text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
            <tr>
              <th className="px-6 py-3">Category name</th>
              <th className="px-6 py-3">Description</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {categories.map((c) => (
              <tr key={c.id} className="hover:bg-[var(--color-surface-sunken)]">
                <td className="px-6 py-4 font-semibold">{c.name}</td>
                <td className="px-6 py-4 text-[var(--color-ink-soft)]">
                  {c.description || '—'}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isActive(c.status)
                        ? 'bg-[var(--color-ok-50)] text-[var(--color-ok-600)]'
                        : 'bg-[var(--color-surface-inset)] text-[var(--color-ink-faint)]'
                    }`}
                  >
                    {isActive(c.status) ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {/* An inline two-step confirm, not `window.confirm`. The
                      native dialog was the last piece of unstyled browser
                      chrome in the console, it cannot be themed, and it blocks
                      the whole tab. Same pattern as the cart's "Empty cart". */}
                  {pendingDelete === c.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-sm text-[var(--color-ink-soft)]">
                        Delete? Products in it are kept.
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(null)}
                        className="btn-ghost px-3 py-1.5 text-sm"
                      >
                        Keep
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="btn-ghost border-[var(--color-danger-600)] px-3 py-1.5 text-sm text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)] hover:text-[var(--color-danger-600)]"
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        aria-label={`Edit ${c.name}`}
                        onClick={() => {
                          setEditCategory(c);
                          setIsEditing(true);
                        }}
                        className="btn-icon"
                      >
                        <Edit2 className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${c.name}`}
                        onClick={() => setPendingDelete(c.id)}
                        className="btn-icon"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-8 text-center text-[var(--color-ink-faint)]"
                >
                  {/* "Loading" and "none exist" are different facts, and saying
                      the second while the first is true is how an admin
                      concludes their catalogue is gone. */}
                  {isLoading ? 'Loading categories…' : 'No categories defined yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
