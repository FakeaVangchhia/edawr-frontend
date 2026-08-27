import { beforeEach, describe, expect, it } from 'vitest';
import {
  addAddress,
  readAddresses,
  removeAddress,
  selectAddress,
  selectedAddress,
  toDeliveryAddress,
  updateAddress,
} from './addresses';

/**
 * The address book, against real localStorage (jsdom provides it).
 *
 * The cases that matter are the ones where the selection and the list disagree:
 * deleting the selected entry, and reading back a stored selection that points
 * at an entry no longer in the book. Either one leaves checkout prefilling from
 * nothing while addresses are plainly on screen.
 *
 * Note these tests share one module-level store, so each starts by clearing
 * localStorage *and* writing through the module's own API to resync it.
 */

const KEY = 'edawr-addresses-v1';

const seed = () =>
  addAddress({ label: 'Home', line: 'Chaltlang Block C', city: 'Aizawl', landmark: '' });

beforeEach(() => {
  window.localStorage.clear();
  // The store caches its snapshot, so clearing storage alone would leave the
  // previous test's entries in memory. Removing them through the API resyncs.
  for (const entry of readAddresses().entries) removeAddress(entry.id);
});

describe('addAddress', () => {
  it('saves the entry and selects it', () => {
    const entry = seed();
    const book = readAddresses();

    expect(book.entries).toHaveLength(1);
    expect(book.selectedId).toBe(entry.id);
    expect(selectedAddress(book)).toEqual(entry);
  });

  it('selects each newly added address, which is what the customer meant', () => {
    seed();
    const work = addAddress({ label: 'Work', line: 'Zarkawt', city: 'Aizawl', landmark: '' });

    expect(readAddresses().selectedId).toBe(work.id);
  });

  it('gives every entry a distinct id', () => {
    const ids = [1, 2, 3].map(
      () => addAddress({ label: 'A', line: 'Somewhere', city: 'Aizawl', landmark: '' }).id,
    );
    expect(new Set(ids).size).toBe(3);
  });

  it('persists to localStorage so another tab sees it', () => {
    seed();
    const raw = window.localStorage.getItem(KEY);
    expect(raw).toContain('Chaltlang Block C');
  });
});

describe('removeAddress', () => {
  it('moves the selection when the selected entry is deleted', () => {
    const home = seed();
    const work = addAddress({ label: 'Work', line: 'Zarkawt', city: 'Aizawl', landmark: '' });
    selectAddress(work.id);

    removeAddress(work.id);

    const book = readAddresses();
    expect(book.entries.map((entry) => entry.id)).toEqual([home.id]);
    // The critical part: not left pointing at a deleted entry.
    expect(book.selectedId).toBe(home.id);
    expect(selectedAddress(book)).not.toBeNull();
  });

  it('leaves an unrelated selection alone', () => {
    const home = seed();
    const work = addAddress({ label: 'Work', line: 'Zarkawt', city: 'Aizawl', landmark: '' });
    selectAddress(home.id);

    removeAddress(work.id);

    expect(readAddresses().selectedId).toBe(home.id);
  });

  it('empties the selection along with the last entry', () => {
    const home = seed();
    removeAddress(home.id);

    const book = readAddresses();
    expect(book.entries).toEqual([]);
    expect(book.selectedId).toBeNull();
    expect(selectedAddress(book)).toBeNull();
  });
});

describe('selectAddress', () => {
  it('ignores an id that is not in the book', () => {
    const home = seed();
    selectAddress('addr-does-not-exist');
    expect(readAddresses().selectedId).toBe(home.id);
  });
});

describe('updateAddress', () => {
  it('patches one entry and leaves the rest untouched', () => {
    const home = seed();
    const work = addAddress({ label: 'Work', line: 'Zarkawt', city: 'Aizawl', landmark: '' });

    updateAddress(home.id, { label: 'Parents' });

    const book = readAddresses();
    expect(book.entries.find((entry) => entry.id === home.id)?.label).toBe('Parents');
    expect(book.entries.find((entry) => entry.id === work.id)?.label).toBe('Work');
  });
});

describe('selectedAddress', () => {
  it('falls back to the first entry when the selection is stale', () => {
    // Exactly what a hand-edited or older-format localStorage value looks like.
    const book = {
      entries: [
        { id: 'a', label: 'Home', line: 'Somewhere', city: 'Aizawl', landmark: '' },
        { id: 'b', label: 'Work', line: 'Elsewhere', city: 'Aizawl', landmark: '' },
      ],
      selectedId: 'gone',
    };

    expect(selectedAddress(book)?.id).toBe('a');
  });

  it('is null for an empty book rather than throwing', () => {
    expect(selectedAddress({ entries: [], selectedId: null })).toBeNull();
  });
});

describe('toDeliveryAddress', () => {
  const base = { id: 'a', label: 'Home', line: 'Chaltlang Block C', city: 'Aizawl' };

  it('joins the line and the city', () => {
    expect(toDeliveryAddress({ ...base, landmark: '' })).toBe('Chaltlang Block C, Aizawl');
  });

  it('leaves the landmark out — the API has its own field for it', () => {
    const flattened = toDeliveryAddress({ ...base, landmark: 'Near the church' });
    expect(flattened).not.toContain('church');
  });

  it('does not leave a dangling comma when the city is blank', () => {
    expect(toDeliveryAddress({ ...base, city: '  ', landmark: '' })).toBe('Chaltlang Block C');
  });

  it('always clears the length the server requires of a real address', () => {
    // CheckoutSerializer.validate_customer_address wants eight characters.
    expect(toDeliveryAddress({ ...base, landmark: '' }).length).toBeGreaterThanOrEqual(8);
  });
});
