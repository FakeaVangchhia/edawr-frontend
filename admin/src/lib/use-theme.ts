'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_KEY = 'edawr-console-theme';

/**
 * The theme preference, stored and applied to `<html data-theme>`.
 *
 * Three states, not two. "System" is the default and is represented by the
 * *absence* of the attribute, which lets the CSS fall through to
 * `prefers-color-scheme` — so an operator who has their phone on an automatic
 * light/dark schedule gets that for free, and only someone who actively wants
 * to override it stores anything at all.
 *
 * The initial application happens in a blocking inline script in the root
 * layout, before first paint. This hook only handles changes made afterwards.
 */

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY || event.key === null) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(THEME_KEY);
  return stored === 'dark' || stored === 'light' ? stored : 'system';
}

// The server cannot know the preference. It renders the system default, and the
// inline bootstrap corrects it before paint — which is why `<html>` carries
// suppressHydrationWarning.
const getServerSnapshot = (): ThemePreference => 'system';

export function useTheme(): [ThemePreference, (next: ThemePreference) => void] {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: ThemePreference) => {
    if (next === 'system') {
      window.localStorage.removeItem(THEME_KEY);
      document.documentElement.removeAttribute('data-theme');
    } else {
      window.localStorage.setItem(THEME_KEY, next);
      document.documentElement.setAttribute('data-theme', next);
    }
    notify();
  }, []);

  return [theme, setTheme];
}
