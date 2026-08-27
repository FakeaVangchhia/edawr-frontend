import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalStore } from './local-store';
import { clearProfile, hasProfile, readProfile, saveProfile } from './profile';
import { clearRecentSearches, readRecentSearches, rememberSearch } from './recent-searches';

/**
 * The localStorage stores, and the property that keeps them safe:
 * **stored data is untrusted input.** It survives deploys, so it may have been
 * written by an older version of this code with a different shape — or by hand.
 * A store that hands a malformed value straight to a component throws inside a
 * `.map()` during render, which blanks the page rather than degrading.
 *
 * The other property tested here is snapshot **identity**, which is not a
 * micro-optimisation: `useSyncExternalStore` compares by reference, so a
 * `getSnapshot` that allocates on every call re-renders forever.
 */

beforeEach(() => {
  window.localStorage.clear();
  clearProfile();
  clearRecentSearches();
});

describe('createLocalStore', () => {
  const make = (key: string) =>
    createLocalStore<string[]>({
      key,
      empty: [],
      parse: (raw) => (Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : null),
    });

  it('falls back to empty rather than throwing on malformed JSON', () => {
    window.localStorage.setItem('ls-bad-json', '{not json at all');
    expect(make('ls-bad-json').read()).toEqual([]);
  });

  it('falls back to empty when the stored shape is wrong', () => {
    window.localStorage.setItem('ls-wrong-shape', JSON.stringify({ nope: true }));
    expect(make('ls-wrong-shape').read()).toEqual([]);
  });

  it('keeps the valid part of a partly corrupt value', () => {
    window.localStorage.setItem('ls-partial', JSON.stringify(['milk', 42, null, 'bread']));
    expect(make('ls-partial').read()).toEqual(['milk', 'bread']);
  });

  it('returns a reference-stable snapshot between writes', () => {
    const store = make('ls-stable');
    store.write(['a']);
    // Two reads with nothing in between must be the same object, or
    // useSyncExternalStore sees a changed store on every render.
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it('gives the server the empty value, so first render matches SSR', () => {
    const store = make('ls-server');
    store.write(['a', 'b']);
    expect(store.getServerSnapshot()).toEqual([]);
  });

  it('notifies subscribers on write', () => {
    const store = make('ls-notify');
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });

    store.write(['a']);
    expect(calls).toBe(1);

    unsubscribe();
    store.write(['b']);
    expect(calls).toBe(1);
  });
});

describe('profile', () => {
  it('starts empty', () => {
    expect(readProfile()).toEqual({ name: '', phone: '' });
    expect(hasProfile(readProfile())).toBe(false);
  });

  it('trims what it saves', () => {
    saveProfile({ name: '  Lalrin  ', phone: ' 9812345678 ' });
    expect(readProfile()).toEqual({ name: 'Lalrin', phone: '9812345678' });
  });

  it('counts a half-filled profile as something worth prefilling from', () => {
    saveProfile({ name: 'Lalrin', phone: '' });
    expect(hasProfile(readProfile())).toBe(true);
  });

  it('treats whitespace as empty', () => {
    saveProfile({ name: '   ', phone: '   ' });
    expect(hasProfile(readProfile())).toBe(false);
  });

  it('survives a stored value missing a field', () => {
    window.localStorage.clear();
    window.localStorage.setItem('edawr-profile-v1', JSON.stringify({ name: 'Lalrin' }));
    // Read through a fresh store to bypass the module's cached snapshot.
    const store = createLocalStore<{ name: string; phone: string }>({
      key: 'edawr-profile-v1',
      empty: { name: '', phone: '' },
      parse: (raw) => {
        if (typeof raw !== 'object' || raw === null) return null;
        const c = raw as { name?: unknown; phone?: unknown };
        return {
          name: typeof c.name === 'string' ? c.name : '',
          phone: typeof c.phone === 'string' ? c.phone : '',
        };
      },
    });
    expect(store.read()).toEqual({ name: 'Lalrin', phone: '' });
  });
});

describe('recent searches', () => {
  it('puts the newest term first', () => {
    rememberSearch('milk');
    rememberSearch('bread');
    expect(readRecentSearches()).toEqual(['bread', 'milk']);
  });

  it('moves a repeated term to the front instead of duplicating it', () => {
    rememberSearch('milk');
    rememberSearch('bread');
    rememberSearch('milk');
    expect(readRecentSearches()).toEqual(['milk', 'bread']);
  });

  it('treats a differently-cased repeat as the same term', () => {
    rememberSearch('Milk');
    rememberSearch('milk');
    expect(readRecentSearches()).toEqual(['milk']);
  });

  it('ignores an empty or whitespace-only term', () => {
    rememberSearch('   ');
    rememberSearch('');
    expect(readRecentSearches()).toEqual([]);
  });

  it('trims what it stores', () => {
    rememberSearch('  milk  ');
    expect(readRecentSearches()).toEqual(['milk']);
  });

  it('caps the list so it cannot grow without bound', () => {
    for (const term of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) rememberSearch(term);
    const stored = readRecentSearches();
    expect(stored).toHaveLength(6);
    expect(stored[0]).toBe('h');
  });
});
