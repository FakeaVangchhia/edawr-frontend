import { describe, expect, it } from 'vitest';
import { categoryPutBody } from './CategoriesList';
import type { Category } from '@/types';

/**
 * What the category editor sends on save.
 *
 * `CategoryDetailView` is a non-partial `PUT`, and `CategorySerializer` gives
 * `image_url` a default of `null` and `sort_order` a default of `0`. So an
 * omitted field is not "leave it alone" — it is "reset it". The editor used to
 * send four fields, which meant fixing a typo in a category name silently
 * blanked its storefront rail image and sent the tile back to position 0.
 *
 * These assertions are the regression: they fail against the four-field body.
 */

function category(overrides: Partial<Category> = {}): Partial<Category> {
  return {
    id: 3,
    name: 'Dairy & Bread',
    description: 'Milk, curd, paneer',
    parent_id: null,
    status: 'active',
    image_url: '/uploads/dairy-a1b2c3.png',
    sort_order: 2,
    ...overrides,
  };
}

describe('categoryPutBody', () => {
  it('preserves the rail image the form cannot edit', () => {
    expect(categoryPutBody(category()).image_url).toBe('/uploads/dairy-a1b2c3.png');
  });

  it('preserves the sort order', () => {
    expect(categoryPutBody(category()).sort_order).toBe(2);
  });

  it('sends an explicit null for a category that has no image', () => {
    // Not `undefined` — DRF would apply the field default either way, but the
    // intent has to be readable in the request body.
    expect(categoryPutBody(category({ image_url: null })).image_url).toBeNull();
  });

  it('defaults sort_order to 0 for a brand new category', () => {
    const body = categoryPutBody({ name: 'Snacks' });
    expect(body.sort_order).toBe(0);
    expect(body.image_url).toBeNull();
  });

  it('lowercases status to match the model default', () => {
    // The backend filters with `status__iexact`, so casing never broke the
    // storefront — it broke the console, which compared exactly and showed
    // every seeded category as inactive.
    expect(categoryPutBody(category({ status: 'Active' })).status).toBe('active');
    expect(categoryPutBody(category({ status: 'Inactive' })).status).toBe('inactive');
  });

  it('treats a missing status as active', () => {
    expect(categoryPutBody({ name: 'Snacks' }).status).toBe('active');
  });

  it('coerces an empty parent to null rather than sending 0', () => {
    // `parent_id: 0` would be a foreign key to a row that cannot exist.
    expect(categoryPutBody(category({ parent_id: null })).parent_id).toBeNull();
  });

  it('sends an empty string rather than undefined for a blank description', () => {
    // DRF CharField rejects null but accepts "" via the shared OPTIONAL_TEXT
    // kwargs, so the empty string is the one that round-trips.
    expect(categoryPutBody(category({ description: '' })).description).toBe('');
  });
});
